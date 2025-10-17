/**
 * 파일 경로: /src/contexts/CartContext.tsx
 * 작성 날짜: 2025-09-28
 * 주요 내용: 장바구니 상태 관리 컨텍스트
 * 관련 데이터: cart 컬렉션, localStorage (사용자별 분리)
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { CartItem } from '../types/saleOrder'; // Updated: 2025-09-28
import type { Product } from '../types/product'; // Updated: 2025-09-28
import { useAuth } from '../hooks/useAuth';

// 장바구니 상태 인터페이스
interface CartState {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  isLoading: boolean;
}

// 장바구니 액션 타입
type CartAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'ADD_ITEM'; payload: { productId: string; quantity: number } }
  | { type: 'UPDATE_ITEM'; payload: { productId: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'CLEAR_CART' }
  | { type: 'UPDATE_TOTALS'; payload: { totalItems: number; totalAmount: number } };

// 장바구니 컨텍스트 인터페이스
interface CartContextType {
  state: CartState;
  addToCart: (productId: string, quantity?: number) => void;
  updateCartItem: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getCartItem: (productId: string) => CartItem | undefined;
  calculateTotals: (products: Product[]) => void;
}

// 초기 상태
const initialState: CartState = {
  items: [],
  totalItems: 0,
  totalAmount: 0,
  isLoading: false,
};

// 리듀서 함수
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_CART': {
      const totalItems = action.payload.reduce((sum, item) => sum + item.quantity, 0);
      return { ...state, items: action.payload, totalItems };
    }

    case 'ADD_ITEM': {
      const existingItemIndex = state.items.findIndex(
        item => item.productId === action.payload.productId
      );

      let updatedItems: CartItem[];
      if (existingItemIndex >= 0) {
        // 기존 아이템 수량 업데이트
        updatedItems = [...state.items];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + action.payload.quantity,
        };
      } else {
        // 새 아이템 추가
        const newItem: CartItem = {
          productId: action.payload.productId,
          quantity: action.payload.quantity,
          addedAt: Timestamp.now(),
        };
        updatedItems = [...state.items, newItem];
      }

      // totalItems 자동 계산
      const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      return { ...state, items: updatedItems, totalItems };
    }

    case 'UPDATE_ITEM': {
      let updatedItems: CartItem[];

      if (action.payload.quantity <= 0) {
        // 수량이 0 이하면 아이템 제거
        updatedItems = state.items.filter(item => item.productId !== action.payload.productId);
      } else {
        const existingItemIndex = state.items.findIndex(
          item => item.productId === action.payload.productId
        );

        if (existingItemIndex >= 0) {
          // 기존 아이템 수량 업데이트
          updatedItems = [...state.items];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: action.payload.quantity,
          };
        } else {
          // 새 아이템 추가
          const newItem: CartItem = {
            productId: action.payload.productId,
            quantity: action.payload.quantity,
            addedAt: Timestamp.fromDate(new Date()),
          };
          updatedItems = [...state.items, newItem];
        }
      }

      // totalItems 자동 계산
      const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      return { ...state, items: updatedItems, totalItems };
    }

    case 'REMOVE_ITEM': {
      const updatedItems = state.items.filter(item => item.productId !== action.payload);
      const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      return { ...state, items: updatedItems, totalItems };
    }

    case 'CLEAR_CART':
      return { ...state, items: [], totalItems: 0, totalAmount: 0 };

    case 'UPDATE_TOTALS':
      return {
        ...state,
        totalItems: action.payload.totalItems,
        totalAmount: action.payload.totalAmount,
      };

    default:
      return state;
  }
};

// 컨텍스트 생성
const CartContext = createContext<CartContextType | undefined>(undefined);

// 컨텍스트 프로바이더
interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const { user } = useAuth();

  // 사용자별 장바구니 키 생성
  const getCartKey = useCallback(() => {
    if (!user) return 'cart_guest';
    // 사용자 + 고객사별로 장바구니 분리 (URL에서 읽기)
    const urlParams = new URLSearchParams(window.location.search);
    const customerKey = urlParams.get('customer') || 'default';
    return `cart_${user.uid}_${customerKey}`;
  }, [user]);

  // localStorage에서 장바구니 로드
  useEffect(() => {
    if (!user) return; // 로그인 전에는 로드하지 않음

    const cartKey = getCartKey();
    const savedCart = localStorage.getItem(cartKey);

    if (savedCart) {
      try {
        const cartItems = JSON.parse(savedCart) as CartItem[];
        dispatch({ type: 'SET_CART', payload: cartItems });
      } catch (error) {
      // Error handled silently
        console.error('장바구니 로드 실패:', error);
        localStorage.removeItem(cartKey);
      }
    } else {
      // 기존 장바구니가 없으면 초기화
      dispatch({ type: 'CLEAR_CART' });
    }
  }, [user, getCartKey]);

  // 장바구니 변경 시 localStorage 저장
  useEffect(() => {
    if (!user) return; // 로그인 전에는 저장하지 않음

    const cartKey = getCartKey();
    localStorage.setItem(cartKey, JSON.stringify(state.items));
  }, [state.items, user, getCartKey]);

  // 장바구니에 상품 추가
  const addToCart = (productId: string, quantity: number = 1) => {
    dispatch({
      type: 'ADD_ITEM',
      payload: { productId, quantity },
    });
  };

  // 장바구니 아이템 수량 업데이트
  const updateCartItem = (productId: string, quantity: number) => {
    dispatch({
      type: 'UPDATE_ITEM',
      payload: { productId, quantity },
    });
  };

  // 장바구니에서 상품 제거
  const removeFromCart = (productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: productId });
  };

  // 장바구니 비우기
  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  // 특정 상품의 장바구니 아이템 조회
  const getCartItem = (productId: string): CartItem | undefined => {
    return state.items.find(item => item.productId === productId);
  };

  // 총액 계산 (상품 정보와 함께)
  const calculateTotals = (products: Product[]) => {
    let totalItems = 0;
    let totalAmount = 0;

    state.items.forEach(cartItem => {
      const product = products.find(p => p.productId === cartItem.productId);
      if (product) {
        totalItems += cartItem.quantity;
        // TODO: 고객사 유형별 가격 적용 로직 추가
        totalAmount += product.salePrices.standard * cartItem.quantity;
      }
    });

    dispatch({
      type: 'UPDATE_TOTALS',
      payload: { totalItems, totalAmount },
    });
  };

  const contextValue: CartContextType = {
    state,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartItem,
    calculateTotals,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

// 컨텍스트 사용 훅
// eslint-disable-next-line react-refresh/only-export-components
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartProvider;