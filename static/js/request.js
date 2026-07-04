const pricingForm = document.querySelector("[data-pricing-form]");

if (pricingForm) {
  const addOnInputs = [...pricingForm.querySelectorAll("[data-addon]")];
  const totalElement = pricingForm.querySelector("[data-total]");
  const basePrice = Number(totalElement.dataset.basePrice || "75");

  function formatCurrency(value) {
    return `$${value}`;
  }

  function updateTotal() {
    const addOnTotal = addOnInputs.reduce((sum, input) => {
      return input.checked ? sum + Number(input.dataset.price || 0) : sum;
    }, 0);

    totalElement.textContent = formatCurrency(basePrice + addOnTotal);
  }

  addOnInputs.forEach((input) => input.addEventListener("change", updateTotal));
  updateTotal();
}
