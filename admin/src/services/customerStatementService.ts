/**
 * 파일 경로: /src/services/customerStatementService.ts
 * 작성 날짜: 2025-10-14
 * 주요 내용: 고객사 거래명세서 생성 서비스
 */

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { CustomerStatement } from '../types/customerStatement';
import type { CollectionMethod } from '../types/customerCollection';
import { getCustomerAccount, getCustomerCollections } from './customerCollectionService';

/**
 * 결제 수단 레이블 변환
 */
const getCollectionMethodLabel = (method: CollectionMethod): string => {
  const labels: Record<CollectionMethod, string> = {
    cash: '현금',
    card: '카드',
    bank_transfer: '계좌이체',
    tax_invoice: '세금계산서'
  };
  return labels[method] || method;
};

/**
 * 거래명세서 생성
 */
export const generateStatement = async (
  customerId: string,
  startDate: Date,
  endDate: Date,
  generatedBy: string
): Promise<CustomerStatement> => {
  try {
    // 1. 고객사 계정 조회
    const account = await getCustomerAccount(customerId);
    if (!account) {
      throw new Error('고객사 계정을 찾을 수 없습니다.');
    }

    // 2. 기간 내 매출원장 조회
    const salesQuery = query(
      collection(db, 'saleLedgers'),
      where('customerId', '==', customerId),
      where('shippedAt', '>=', Timestamp.fromDate(startDate)),
      where('shippedAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('shippedAt', 'asc')
    );

    const salesSnapshot = await getDocs(salesQuery);
    const salesLedgers = salesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        saleLedgerNumber: data.saleLedgerNumber,
        saleDate: data.shippedAt,
        amount: data.totalAmount,
        description: `상품 ${data.itemCount}종 출하`
      };
    });

    // 3. 기간 내 수금 내역 조회
    const collections = await getCustomerCollections(customerId, startDate, endDate);
    const collectionDetails = collections.map(collection => ({
      collectionNumber: collection.collectionNumber,
      collectionDate: collection.collectionDate,
      collectionMethod: getCollectionMethodLabel(collection.collectionMethod),
      amount: collection.collectionAmount
    }));

    // 4. 이월 미수금 계산 (startDate 이전 잔액)
    const previousSalesQuery = query(
      collection(db, 'saleLedgers'),
      where('customerId', '==', customerId),
      where('shippedAt', '<', Timestamp.fromDate(startDate))
    );

    const previousCollectionsQuery = query(
      collection(db, 'customerPayments'),
      where('customerId', '==', customerId),
      where('collectionDate', '<', Timestamp.fromDate(startDate))
    );

    const [prevSalesSnap, prevCollectionsSnap] = await Promise.all([
      getDocs(previousSalesQuery),
      getDocs(previousCollectionsQuery)
    ]);

    const previousSales = prevSalesSnap.docs.reduce(
      (sum, doc) => sum + doc.data().totalAmount,
      0
    );
    const previousPayments = prevCollectionsSnap.docs.reduce(
      (sum, doc) => sum + doc.data().collectionAmount,
      0
    );
    const previousBalance = previousSales - previousPayments;

    // 5. 당기 금액 계산
    const currentSalesAmount = salesLedgers.reduce((sum, s) => sum + s.amount, 0);
    const currentCollectionAmount = collectionDetails.reduce((sum, p) => sum + p.amount, 0);
    const currentBalance = previousBalance + currentSalesAmount - currentCollectionAmount;

    // 6. 거래명세서 생성
    const statement: CustomerStatement = {
      customerId,
      customerName: account.customerName,
      periodStart: startDate,
      periodEnd: endDate,
      previousBalance,
      currentSalesAmount,
      currentCollectionAmount,
      currentBalance,
      salesLedgers,
      payments: collectionDetails,
      generatedAt: Timestamp.now(),
      generatedBy
    };

    return statement;

  } catch (error) {
      // Error handled silently
    console.error('Error generating statement:', error);
    throw new Error('거래명세서 생성 중 오류가 발생했습니다.');
  }
};

export default {
  generateStatement
};
