/// <reference types="vite/client" />

// Daum Postcode API 타입 선언
declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: {
          address: string;
          addressType: string;
          bname: string;
          buildingName: string;
        }) => void;
      }) => {
        open: () => void;
      };
    };
  }
}

export {};