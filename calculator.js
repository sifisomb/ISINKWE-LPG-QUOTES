const Calculator = (function () {
  const VAT_RATE = 0.15;
  const depositAmounts = {
    "9": 450,
    "14": 550,
    "19": 600,
    "19-forklift": 700,
    "48-single": 1050,
    "48-double": 1050
  };
  let cylinderCounter = 0;
  let showIncludingVAT = false;
  const state = {
    cylindersData: [],
    quoteTotals: {},
    elements: {
      clientName: document.getElementById('clientName'),
      businessName: document.getElementById('businessName'),
      clientCell: document.getElementById('clientCell'),
      clientEmail: document.getElementById('clientEmail'),
      clientAddress: document.getElementById('clientAddress'),
      yourPrice: document.getElementById('yourPrice'),
      deliveryFee: document.getElementById('deliveryFee'),
      marketPrice: document.getElementById('marketPrice'),
      cylinderOption: document.getElementById('cylinderOption'),
      marketTotalPrice: document.getElementById('marketTotalPrice'),
      marketPriceInclVAT: document.getElementById('marketPriceInclVAT'),
      quoteSection: document.getElementById('quote-section'),
      afterQuoteLinks: document.getElementById('afterQuoteLinks'),
      exchangeFields: document.getElementById('exchangeFields'),
      tpnConsentField: document.getElementById('tpnConsentField'),
      cylindersContainer: document.getElementById('cylindersContainer'),
      cylinderDetailsContainer: document.getElementById('cylinderDetailsContainer'),
      totalQuantity: document.getElementById('totalQuantity'),
      totalYourPrice: document.getElementById('totalYourPrice'),
      totalPriceLabel: document.getElementById('totalPriceLabel'),
      marketPriceLabel: document.getElementById('marketPriceLabel'),
      totalMarketPrice: document.getElementById('totalMarketPrice'),
      savingsLabel: document.getElementById('savingsLabel'),
      totalSavings: document.getElementById('totalSavings'),
      deliveryFeeDisplay: document.getElementById('deliveryFeeDisplay'),
      depositFeeDisplay: document.getElementById('depositFeeDisplay'),
      savingsPerMonth: document.getElementById('savingsPerMonth'),
      savingsPerQuarter: document.getElementById('savingsPerQuarter'),
      savingsPerSixMonths: document.getElementById('savingsPerSixMonths'),
      savingsPerYear: document.getElementById('savingsPerYear')
    }
  };

  // Debounce utility
  const debounce = (func, wait) => {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  // Create cylinder row HTML
  const createCylinderRowHTML = (id) => [
    '<div class="cylinder-row-header">',
    `<div class="cylinder-row-title">Cylinder ${id}</div>`,
    id > 1 ? `<button type="button" class="btn remove-cylinder-btn" data-id="${id}" aria-label="Remove Cylinder ${id}">Remove</button>` : '',
    '</div>',
    `<div class="cylinder-row">`,
    `<div><label for="cylinderSize-${id}">Cylinder Size (kg):</label>`,
    `<select id="cylinderSize-${id}" aria-label="Cylinder ${id} size in kilograms">`,
    '<option value="9">9</option>',
    '<option value="14">14</option>',
    '<option value="19" selected>19</option>',
    '<option value="19-forklift">19-Forklift</option>',
    '<option value="48-single">48-Single</option>',
    '<option value="48-double">48-Double</option>',
    '</select></div>',
    `<div><label for="qtyPerOrder-${id}">Quantity per Order:</label>`,
    `<input type="number" id="qtyPerOrder-${id}" value="1" min="1" aria-label="Quantity per order for Cylinder ${id}"></div>`,
    `<div><label for="ordersPerMonth-${id}">Orders per Month:</label>`,
    `<input type="number" id="ordersPerMonth-${id}" value="1" min="1" aria-label="Orders per month for Cylinder ${id}"></div>`,
    '</div>'
  ].join('');

  // Get address from GPS
  async function getAddressFromGPS() {
    const addressInput = state.elements.clientAddress;
    addressInput.disabled = true;
    addressInput.placeholder = 'Fetching location...';
    try {
      const cached = localStorage.getItem('lastGeolocation');
      if (cached) {
        const { lat, lon, address, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) { // Cache for 1 hour
          addressInput.value = address;
          addressInput.disabled = false;
          addressInput.placeholder = 'Your address will appear here';
          return;
        }
      }
      if (!navigator.geolocation) throw new Error('Geolocation not supported');
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      if (data?.display_name) {
        addressInput.value = data.display_name;
        localStorage.setItem('lastGeolocation', JSON.stringify({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          address: data.display_name,
          timestamp: Date.now(),
        }));
      } else {
        throw new Error('Address not found');
      }
    } catch (error) {
      alert("Unable to retrieve your location. Please check your permissions or enter manually.");
      console.error(error);
    } finally {
      addressInput.disabled = false;
      addressInput.placeholder = 'Your address will appear here';
    }
  }

  // Toggle market price inputs
  function toggleMarketPriceInputs() {
    const knowPrice = document.querySelector('input[name="knowPrice"]:checked').value;
    document.getElementById('marketPricePerKgDiv').style.display = 'block';
    document.getElementById('marketTotalPriceDiv').style.display = knowPrice === 'no' ? 'block' : 'none';
  }

  // Calculate market price per kg
  function calculateMarketPerKg() {
    const { marketTotalPrice, marketPriceInclVAT, marketPrice } = state.elements;
    const totalPrice = parseFloat(marketTotalPrice.value) || 0;
    const inclVAT = marketPriceInclVAT.checked;
    const firstCylinderSize = document.querySelector('.cylinder-row select[id^="cylinderSize-"]')?.value || 0;
    if (totalPrice > 0 && firstCylinderSize > 0) {
      const exclVATPrice = inclVAT ? totalPrice / (1 + VAT_RATE) : totalPrice;
      marketPrice.value = (exclVATPrice / firstCylinderSize).toFixed(2);
    }
  }

  // Add cylinder row
  function addCylinderRow() {
    cylinderCounter++;
    const row = document.createElement('div');
    row.className = 'cylinder-row';
    row.id = `cylinder-${cylinderCounter}`;
    row.innerHTML = createCylinderRowHTML(cylinderCounter);
    state.elements.cylindersContainer.appendChild(row);
  }

  // Remove cylinder row
  function removeCylinderRow(id) {
    const row = document.getElementById(`cylinder-${id}`);
    row?.remove();
  }

  // Get total cylinder weight
  function getTotalCylinderWeight(cylinders) {
    return cylinders.reduce((total, { size, qtyPerOrder, ordersPerMonth }) => 
      total + (size * qtyPerOrder * ordersPerMonth), 0);
  }

  // Update exchange fields
  function updateExchangeFields() {
    const { cylinderOption, exchangeFields, tpnConsentField } = state.elements;
    const isExchange = cylinderOption.value === 'exchange';
    exchangeFields.style.display = isExchange ? 'block' : 'none';
    tpnConsentField.style.display = isExchange ? 'none' : 'block';
  }

  // Calculate savings
  function calculateSavings() {
    const { yourPrice, deliveryFee, marketPrice, cylinderOption } = state.elements;
    const price = parseFloat(yourPrice.value) || 0;
    const delivery = parseFloat(deliveryFee.value) || 0;
    const market = parseFloat(marketPrice.value) || 0;
    const option = cylinderOption.value;

    const cylinders = Array.from(document.querySelectorAll('.cylinder-row')).map(row => {
      const id = row.id.split('-')[1];
      return {
        size: parseFloat(document.getElementById(`cylinderSize-${id}`).value) || 0,
        qtyPerOrder: parseInt(document.getElementById(`qtyPerOrder-${id}`).value) || 0,
        ordersPerMonth: parseInt(document.getElementById(`ordersPerMonth-${id}`).value) || 0,
      };
    }).filter(({ size, qtyPerOrder, ordersPerMonth }) => size > 0 && qtyPerOrder > 0 && ordersPerMonth > 0);

    if (!cylinders.length) {
      alert('Please add at least one cylinder with valid data.');
      return;
    }

    let depositFee = 0;
    state.cylindersData = cylinders.map(cyl => {
      if (option === 'deposit') {
        depositFee += (depositAmounts[cyl.size] || 0) * cyl.qtyPerOrder;
      }
      return {
        ...cyl,
        marketPrice: market,
        yourExcl: price * cyl.size,
        yourIncl: price * cyl.size * (1 + VAT_RATE),
        marketExcl: market * cyl.size,
        marketIncl: market * cyl.size * (1 + VAT_RATE),
      };
    });

    const totals = state.cylindersData.reduce((acc, cyl) => {
      const qtyTotal = cyl.qtyPerOrder * cyl.ordersPerMonth;
      acc.totalQuantity += qtyTotal;
      acc.totalYourExcl += cyl.yourExcl * qtyTotal;
      acc.totalYourIncl += cyl.yourIncl * qtyTotal;
      acc.totalMarketExcl += cyl.marketExcl * qtyTotal;
      acc.totalMarketIncl += cyl.marketIncl * qtyTotal;
      return acc;
    }, {
      totalQuantity: 0,
      totalYourExcl: 0,
      totalYourIncl: delivery,
      totalMarketExcl: 0,
      totalMarketIncl: 0,
    });

    state.quoteTotals = {
      ...totals,
      totalSavingsExcl: totals.totalMarketExcl - totals.totalYourExcl,
      deliveryFee: delivery,
      depositFee,
    };

    showIncludingVAT = false;
    updateQuoteDisplay();
    state.elements.quoteSection.style.display = 'block';
    state.elements.afterQuoteLinks.style.display = 'block';
  }

  // Update quote display
  function updateQuoteDisplay() {
    requestAnimationFrame(() => {
      const { totalQuantity, totalYourExcl, totalYourIncl, totalMarketExcl, totalMarketIncl, totalSavingsExcl, deliveryFee, depositFee } = state.quoteTotals;
      const totalSavingsIncl = totalMarketIncl - totalYourIncl;
      const { totalPriceLabel, totalYourPrice, marketPriceLabel, totalMarketPrice, savingsLabel, totalSavings, totalQuantity: qtyDisplay, deliveryFeeDisplay, depositFeeDisplay, savingsPerMonth, savingsPerQuarter, savingsPerSixMonths, savingsPerYear, cylinderDetailsContainer } = state.elements;

      totalPriceLabel.textContent = `Total Isinkwe Price (${showIncludingVAT ? 'Incl. VAT' : 'Excl. VAT'}):`;
      totalYourPrice.textContent = showIncludingVAT ? `R${totalYourIncl.toFixed(2)}` : `R${totalYourExcl.toFixed(2)}`;
      marketPriceLabel.textContent = showIncludingVAT ? 'Incl. VAT' : 'Excl. VAT';
      totalMarketPrice.textContent = showIncludingVAT ? `R${totalMarketIncl.toFixed(2)}` : `R${totalMarketExcl.toFixed(2)}`;
      savingsLabel.textContent = showIncludingVAT ? 'Incl. VAT' : 'Excl. VAT';
      totalSavings.textContent = showIncludingVAT ? `R${totalSavingsIncl.toFixed(2)}` : `R${totalSavingsExcl.toFixed(2)}`;
      qtyDisplay.textContent = totalQuantity.toFixed(2);
      deliveryFeeDisplay.textContent = `R${deliveryFee.toFixed(2)}`;
      depositFeeDisplay.textContent = `R${depositFee.toFixed(2)}`;

      const savings = showIncludingVAT ? totalSavingsIncl : totalSavingsExcl;
      savingsPerMonth.textContent = `R${savings.toFixed(2)}`;
      savingsPerQuarter.textContent = `R${(savings * 3).toFixed(2)}`;
      savingsPerSixMonths.textContent = `R${(savings * 6).toFixed(2)}`;
      savingsPerYear.textContent = `R${(savings * 12).toFixed(2)}`;

      cylinderDetailsContainer.innerHTML = state.cylindersData.map((cyl, index) => `
        <div class="cylinder-card">
          <div class="cylinder-grid">
            <div><div class="grid-item-label">Cylinder ${index + 1}</div>${cyl.size} kg</div>
            <div><div class="grid-item-label">Quantity per Order</div>${cyl.qtyPerOrder}</div>
            <div><div class="grid-item-label">Orders per Month</div>${cyl.ordersPerMonth}</div>
            <div><div class="grid-item-label">Isinkwe Price</div><span class="cylinder-price">R${showIncludingVAT ? cyl.yourIncl.toFixed(2) : cyl.yourExcl.toFixed(2)}</span></div>
            <div><div class="grid-item-label">Supplier Price</div><span class="cylinder-price">R${showIncludingVAT ? cyl.marketIncl.toFixed(2) : cyl.marketExcl.toFixed(2)}</span></div>
          </div>
        </div>
      `).join('');
    });
  }

  // Handle VAT toggle
  function handleVATToggle(event) {
    if (event.target.classList.contains('total-price')) {
      showIncludingVAT = !showIncludingVAT;
      updateQuoteDisplay();
    }
  }

  // Handle remove cylinder
  function handleRemoveCylinder(event) {
    if (event.target.classList.contains('remove-cylinder-btn')) {
      const id = event.target.dataset.id;
      removeCylinderRow(id);
    }
  }

  // Handle accordion toggle
  function handleAccordionToggle(event) {
    if (event.target.classList.contains('accordion-header')) {
      const contentId = event.target.getAttribute('aria-controls');
      const content = document.getElementById(contentId);
      const isExpanded = event.target.getAttribute('aria-expanded') === 'true';
      event.target.setAttribute('aria-expanded', !isExpanded);
      content.style.display = isExpanded ? 'none' : 'block';
    }
  }

  // PDF Generation
  async function downloadPDF() {
    try {
      const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@latest/dist/jspdf.es.min.js');
      const doc = new jsPDF();
      const { clientName, clientEmail, clientAddress, businessName } = state.elements;
      const { totalQuantity, totalYourIncl, totalMarketIncl, totalSavingsIncl, deliveryFee, depositFee } = state.quoteTotals;

      doc.setFontSize(16);
      doc.text('Isinkwe Energies Quote', 10, 10);
      doc.setFontSize(12);
      doc.text(`Client: ${clientName.value || 'N/A'}`, 10, 20);
      doc.text(`Business: ${businessName.value || 'N/A'}`, 10, 30);
      doc.text(`Email: ${clientEmail.value || 'N/A'}`, 10, 40);
      doc.text(`Address: ${clientAddress.value || 'N/A'}`, 10, 50);
      
      doc.text('Quote Summary', 10, 70);
      doc.text(`Total Quantity: ${totalQuantity.toFixed(2)} kg`, 10, 80);
      doc.text(`Total Price (Incl. VAT): R${totalYourIncl.toFixed(2)}`, 10, 90);
      doc.text(`Supplier Price (Incl. VAT): R${totalMarketIncl.toFixed(2)}`, 10, 100);
      doc.text(`Savings (Incl. VAT): R${totalSavingsIncl.toFixed(2)}`, 10, 110);
      doc.text(`Delivery Fee: R${deliveryFee.toFixed(2)}`, 10, 120);
      doc.text(`Deposit Fee: R${depositFee.toFixed(2)}`, 10, 130);

      let y = 150;
      state.cylindersData.forEach((cyl, i) => {
        doc.text(`Cylinder ${i + 1}: ${cyl.size} kg, Qty: ${cyl.qtyPerOrder}, Orders/Month: ${cyl.ordersPerMonth}`, 10, y);
        y += 10;
      });

      doc.save('isinkwe_quote.pdf');
    } catch (error) {
      alert('Failed to generate PDF.');
      console.error(error);
    }
  }

  // Placeholder functions
  function sendWhatsAppBusinessQuote() {
    alert('WhatsApp Business quote sending not implemented yet.');
  }

  function sendEmailQuote() {
    alert('Email quote sending not implemented yet.');
  }

  // Initialize
  function init() {
    addCylinderRow();
    toggleMarketPriceInputs();
    updateExchangeFields();
    state.elements.cylindersContainer.addEventListener('click', handleRemoveCylinder);
    state.elements.quoteSection.addEventListener('click', handleVATToggle);
    document.querySelector('.accordion').addEventListener('click', handleAccordionToggle);
    state.elements.marketTotalPrice.addEventListener('input', debounce(calculateMarketPerKg, 300));
    state.elements.marketPriceInclVAT.addEventListener('change', calculateMarketPerKg);
    state.elements.cylinderOption.addEventListener('change', updateExchangeFields);
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    getAddressFromGPS,
    toggleMarketPriceInputs,
    calculateMarketPerKg,
    addCylinderRow,
    removeCylinderRow,
    updateExchangeFields,
    calculateSavings,
    downloadPDF,
    sendWhatsAppBusinessQuote,
    sendEmailQuote,
  };
})();