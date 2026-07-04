const copyButton = document.querySelector("[data-copy-wallet]");
const walletInput = document.querySelector("[data-wallet-address]");

if (copyButton && walletInput) {
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(walletInput.value);
      copyButton.textContent = "Copied";
      setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1800);
    } catch {
      walletInput.select();
      document.execCommand("copy");
      copyButton.textContent = "Copied";
      setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1800);
    }
  });
}
