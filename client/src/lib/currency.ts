// Currency utility functions
export const getCurrencySymbol = (currency: string = "NPR") => {
  const symbols: { [key: string]: string } = {
    NPR: "Rs.",
    USD: "Rs.",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CAD: "C$",
    AUD: "A$",
    CHF: "CHF",
    CNY: "¥",
    INR: "₹",
  };
  return symbols[currency] || "Rs.";
};

export const formatCurrency = (
  amount: number | string,
  currency: string = "NPR",
) => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${numAmount.toFixed(2)}`;
};

export const formatCurrencyForDisplay = (
  amount: number | string,
  currency: string = "NPR",
) => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${numAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
