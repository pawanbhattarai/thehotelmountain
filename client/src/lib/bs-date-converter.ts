// BS (Bikram Sambat) Date Conversion Utility
// Using NepaliFunctions library for accurate conversion

export interface BSDate {
  year: number;
  month: number;
  day: number;
}

export interface ADDate {
  year: number;
  month: number;
  day: number;
}

// Declare global NepaliFunctions to avoid TypeScript errors
declare global {
  interface Window {
    NepaliFunctions?: {
      AD2BS: (adDate: { year: number; month: number; day: number }) => BSDate;
      BS2AD: (bsDate: BSDate) => ADDate;
    };
  }
}

// Function to load the NepaliFunctions library
const loadNepaliFunctions = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.NepaliFunctions) {
      resolve();
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://nepalidatepicker.sajanmaharjan.com.np/v5/nepali.datepicker/js/nepali.datepicker.v5.0.4.min.js';

    script.onload = () => {
      console.log('Nepali date picker script loaded successfully');
      // Wait a bit for the library to initialize
      setTimeout(() => {
        if (window.NepaliFunctions) {
          resolve();
        } else {
          reject(new Error('NepaliFunctions not available after loading'));
        }
      }, 100);
    };

    script.onerror = () => {
      console.error('Failed to load Nepali date picker script');
      reject(new Error('Failed to load NepaliFunctions library'));
    };

    document.head.appendChild(script);
  });
};

// Function to convert AD date to BS using NepaliFunctions
function convertADtoBSInternal(adDateStr: string | Date): string {
  try {
    if (!adDateStr || adDateStr === "NULL" || !window.NepaliFunctions) return "-";

    const adDate = new Date(adDateStr);
    if (isNaN(adDate.getTime())) return "-";

    const bsDateObj = window.NepaliFunctions.AD2BS({
      year: adDate.getFullYear(),
      month: adDate.getMonth() + 1,
      day: adDate.getDate()
    });

    return `${bsDateObj.year}-${String(bsDateObj.month).padStart(2, "0")}-${String(bsDateObj.day).padStart(2, "0")}`;
  } catch (err) {
    console.error("BS conversion error:", err);
    return "-";
  }
}

export const convertADtoBS = async (adDateStr: string | Date): Promise<string> => {
  try {
    if (!adDateStr || adDateStr === "NULL") return "-";

    // Ensure NepaliFunctions is loaded
    if (!window.NepaliFunctions) {
      await loadNepaliFunctions();
    }

    return convertADtoBSInternal(adDateStr);
  } catch (err) {
    console.error("BS conversion error:", err);
    return "-";
  }
};

export const formatDateWithBS = async (adDate: string | Date, showBS: boolean = true): Promise<string> => {
  const adFormatted = new Date(adDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!showBS) {
    return adFormatted;
  }

  try {
    const bsDate = await convertADtoBS(adDate);
    if (bsDate === "-") {
      return adFormatted;
    }
    return `${adFormatted} (${bsDate} BS)`;
  } catch (error) {
    console.error('Error formatting date with BS:', error);
    return adFormatted;
  }
};

export const formatDateTimeWithBS = async (adDateTime: string | Date, showBS: boolean = true): Promise<string> => {
  const adFormatted = new Date(adDateTime).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!showBS) {
    return adFormatted;
  }

  try {
    const bsDate = await convertADtoBS(adDateTime);
    if (bsDate === "-") {
      return adFormatted;
    }
    return `${adFormatted} (${bsDate} BS)`;
  } catch (error) {
    console.error('Error formatting datetime with BS:', error);
    return adFormatted;
  }
};

// Utility function to preload the library
export const preloadNepaliFunctions = async (): Promise<void> => {
  try {
    await loadNepaliFunctions();
    console.log('NepaliFunctions library preloaded successfully');
  } catch (error) {
    console.error('Failed to preload NepaliFunctions library:', error);
  }
};