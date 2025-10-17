/**
 * 파일 경로: /src/components/print/renderers/SaleSlipRenderer.tsx
 * 작성 날짜: 2025-10-13
 * 주요 내용: 매출전표(거래명세서) 렌더러
 */

import type { ReactNode } from 'react';
import { Typography, Box } from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { SaleLedger, SaleLedgerItem } from '../../../types/saleLedger';
import type { Customer } from '../../../types/company';
import type { CustomerAccount } from '../../../types/customerAccount';
import type { DocumentRenderer } from '../types';

interface SaleSlipData {
  ledger: SaleLedger;
  customer: Customer;
  customerAccount: CustomerAccount;
  previousBalance: number;
  currentBalance: number;
}

// 진현유통 회사 정보 (하드코딩)
const COMPANY_INFO = {
  businessName: '주식회사 진현유통',
  president: '이민정',
  businessNumber: '107-88-04848',
  address: '서울특별시 영등포구 영신로 452길 5,3-2 1층',
  phone: '02-2676-8600',
  mobile: '010-3888-8601',
  bankAccount: '기업은행 077-164344-01-013',
};

// 숫자를 한글로 변환하는 함수
const numberToKorean = (num: number): string => {
  const units = ['', '만', '억', '조'];
  const smallUnits = ['', '십', '백', '천'];

  if (num === 0) return '영';

  let result = '';
  let unitIndex = 0;

  while (num > 0) {
    const part = num % 10000;
    if (part > 0) {
      let partStr = '';
      let tempPart = part;
      let smallUnitIndex = 0;

      while (tempPart > 0) {
        const digit = tempPart % 10;
        if (digit > 0) {
          partStr = (digit === 1 && smallUnitIndex > 0 ? '' : ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'][digit]) +
                    smallUnits[smallUnitIndex] + partStr;
        }
        tempPart = Math.floor(tempPart / 10);
        smallUnitIndex++;
      }
      result = partStr + units[unitIndex] + result;
    }
    num = Math.floor(num / 10000);
    unitIndex++;
  }

  return result;
};

class SaleSlipRendererClass implements DocumentRenderer<SaleSlipData> {
  type = 'sale-slip' as const;

  async loadDocument(id: string): Promise<SaleSlipData> {
    // 매출원장 조회
    const ledgerRef = doc(db, 'saleLedgers', id);
    const ledgerDoc = await getDoc(ledgerRef);

    if (!ledgerDoc.exists()) {
      throw new Error(`매출원장 ${id}를 찾을 수 없습니다.`);
    }

    const ledger = ledgerDoc.data() as SaleLedger;

    // 고객사 정보 조회
    const customerRef = doc(db, 'customers', ledger.customerId);
    const customerDoc = await getDoc(customerRef);

    if (!customerDoc.exists()) {
      throw new Error(`고객사 ${ledger.customerId}를 찾을 수 없습니다.`);
    }

    const customer = customerDoc.data() as Customer;

    // 고객사 계정 조회
    const accountRef = doc(db, 'customerAccounts', ledger.customerId);
    const accountDoc = await getDoc(accountRef);

    if (!accountDoc.exists()) {
      throw new Error(`고객사 계정 ${ledger.customerId}를 찾을 수 없습니다.`);
    }

    const customerAccount = accountDoc.data() as CustomerAccount;

    // 전 잔액 = 현재 잔액 - 이번 출하 금액
    const previousBalance = customerAccount.currentBalance - ledger.totalAmount;
    const currentBalance = customerAccount.currentBalance;

    return { ledger, customer, customerAccount, previousBalance, currentBalance };
  }

  chunkPages(data: SaleSlipData): unknown[][] {
    const ITEMS_PER_PAGE = 15;
    const chunks: SaleLedgerItem[][] = [];

    for (let i = 0; i < data.ledger.ledgerItems.length; i += ITEMS_PER_PAGE) {
      const chunk = data.ledger.ledgerItems.slice(i, i + ITEMS_PER_PAGE);
      chunks.push(chunk);
    }

    // 품목이 없는 경우 빈 페이지 1개 생성
    if (chunks.length === 0) {
      chunks.push([]);
    }

    return chunks;
  }

  renderPage(
    data: SaleSlipData,
    chunk: unknown[],
    pageIndex: number,
    totalPages: number,
    key: string,
    id?: string,
    isLastPage?: boolean
  ): ReactNode {
    const typedChunk = chunk as SaleLedgerItem[];
    const currentPage = pageIndex + 1;
    const { ledger, customer, previousBalance, currentBalance } = data;

    // 마지막 페이지에만 전체 합계 표시
    const _isLastPage = isLastPage ?? (currentPage === totalPages);
    const supplyAmount = Math.floor(ledger.totalAmount / 1.1); // 공급가액 (VAT 제외)
    const vat = ledger.totalAmount - supplyAmount; // VAT (10%)

    return (
      <Box
        key={key}
        id={id}
        className="print-page"
        sx={{
          maxWidth: '210mm',
          margin: '0 auto',
          mb: pageIndex < totalPages - 1 ? 3 : 0,
          border: 1,
          borderColor: 'divider',
          p: 3,
          bgcolor: 'background.paper',
          '@media print': {
            border: 'none',
            p: 0,
            mb: 0,
            margin: 0,
            maxWidth: 'none',
            width: '100%',
            bgcolor: 'transparent'
          }
        }}
      >
        <Box sx={{
          minHeight: '297mm',
          display: 'flex',
          flexDirection: 'column',
          '@media print': {
            minHeight: '297mm'
          }
        }}>
          {/* 상단 - 제목과 공급자 정보 */}
          <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
            {/* 좌측: 제목과 고객사 정보 */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 2, letterSpacing: '0.3em' }}>
                거래명세서
              </Typography>
              <Box sx={{ border: 2, borderColor: 'black', p: 1.5, maxWidth: '360px' }}>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 'bold', mb: 0.5 }}>
                  {customer.businessName}({customer.president}) 귀중
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                  주소: {customer.businessAddress}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                  대표자 휴대폰: {customer.businessPhone || '-'}
                </Typography>
              </Box>
            </Box>

            {/* 우측: 공급자 정보 박스 */}
            <Box sx={{ border: 2, borderColor: 'black', display: 'flex', minWidth: '320px' }}>
              {/* 첫 번째 칼럼: "공급자" 세로 표시 (10%) */}
              <Box sx={{
                width: '10%',
                borderRight: 2,
                borderColor: 'black',
                bgcolor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                writingMode: 'vertical-rl',
                textOrientation: 'upright',
                py: 1
              }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.1em' }}>
                  공급자
                </Typography>
              </Box>

              {/* 두 번째 칼럼: 라벨 (30%) + 세 번째 칼럼: 데이터 (60%) */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '0.7rem' }}>
                {/* 매출원장번호 */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: '33.33%', borderRight: 1, borderColor: 'divider', py: 0.3, px: 0.5, bgcolor: 'grey.100', textAlign: 'center' }}>
                    매출원장번호:
                  </Box>
                  <Box sx={{ width: '66.67%', py: 0.3, px: 0.5 }}>
                    {ledger.saleLedgerNumber}
                  </Box>
                </Box>

                {/* 사업자등록번호 */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: '33.33%', borderRight: 1, borderColor: 'divider', py: 0.3, px: 0.5, bgcolor: 'grey.100', textAlign: 'center' }}>
                    사업자등록번호:
                  </Box>
                  <Box sx={{ width: '66.67%', py: 0.3, px: 0.5 }}>
                    {COMPANY_INFO.businessNumber}
                  </Box>
                </Box>

                {/* 상호 */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: '33.33%', borderRight: 1, borderColor: 'divider', py: 0.3, px: 0.5, bgcolor: 'grey.100', textAlign: 'center' }}>
                    상호:
                  </Box>
                  <Box sx={{ width: '66.67%', py: 0.3, px: 0.5 }}>
                    {COMPANY_INFO.businessName}({COMPANY_INFO.president})
                  </Box>
                </Box>

                {/* 전화번호 */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: '33.33%', borderRight: 1, borderColor: 'divider', py: 0.3, px: 0.5, bgcolor: 'grey.100', textAlign: 'center' }}>
                    전화번호:
                  </Box>
                  <Box sx={{ width: '66.67%', py: 0.3, px: 0.5 }}>
                    {COMPANY_INFO.phone}
                  </Box>
                </Box>

                {/* 주소 */}
                <Box sx={{ display: 'flex' }}>
                  <Box sx={{ width: '33.33%', borderRight: 1, borderColor: 'divider', py: 0.3, px: 0.5, bgcolor: 'grey.100', textAlign: 'center' }}>
                    주소:
                  </Box>
                  <Box sx={{ width: '66.67%', py: 0.3, px: 0.5, fontSize: '0.65rem' }}>
                    {COMPANY_INFO.address}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* 금액 표시 */}
          <Box sx={{ border: 2, borderColor: 'black', display: 'flex', mb: 1 }}>
            <Box sx={{ flex: 1, p: 1, display: 'flex', alignItems: 'center' }}>
              <Typography variant="body1" sx={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                금액: {numberToKorean(ledger.totalAmount)}원 정
              </Typography>
            </Box>
            <Box sx={{ width: '200px', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Typography variant="body1" sx={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                (₩{ledger.totalAmount.toLocaleString()})
              </Typography>
            </Box>
          </Box>

          {/* 품목 테이블 */}
          <Box sx={{ flex: 1, mb: 2, border: 1, borderColor: 'divider' }}>
            {/* 테이블 헤더 */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '8% 1fr 18% 12% 14% 17%',
                bgcolor: 'grey.100',
                borderBottom: 1,
                borderColor: 'divider'
              }}
            >
              <Box sx={{ p: 0.8, borderRight: 1, borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                  번호
                </Typography>
              </Box>
              <Box sx={{ p: 0.8, borderRight: 1, borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                  상품명
                </Typography>
              </Box>
              <Box sx={{ p: 0.8, borderRight: 1, borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                  규격
                </Typography>
              </Box>
              <Box sx={{ p: 0.8, borderRight: 1, borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                  수량
                </Typography>
              </Box>
              <Box sx={{ p: 0.8, borderRight: 1, borderColor: 'divider', textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                  단가
                </Typography>
              </Box>
              <Box sx={{ p: 0.8, textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                  공급가액
                </Typography>
              </Box>
            </Box>

            {/* 테이블 바디 */}
            {typedChunk.map((item, idx) => {
              const itemNumber = pageIndex * 15 + idx + 1;
              return (
                <Box
                  key={idx}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '8% 1fr 18% 12% 14% 17%',
                    borderBottom: 1,
                    borderColor: 'divider',
                    minHeight: 32
                  }}
                >
                  <Box sx={{ p: 0.5, borderRight: 1, borderColor: 'divider', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                      {itemNumber}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.5, borderRight: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                      {item.productName}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.5, borderRight: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                      {item.specification || '-'}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.5, borderRight: 1, borderColor: 'divider', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                      {item.quantity.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.5, borderRight: 1, borderColor: 'divider', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                      {item.unitPrice.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                      {item.lineTotal.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* 하단 합계 정보 */}
          {_isLastPage && (
            <Box sx={{ mt: 'auto', mb: '50px' }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* 좌측 카드: 잔액 정보 */}
                <Box sx={{ flex: 1, border: 1, borderColor: 'divider' }}>
                {/* 전 잔액 */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: '40%', borderRight: 1, borderColor: 'divider', bgcolor: 'grey.100', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      전 잔액:
                    </Typography>
                  </Box>
                  <Box sx={{ width: '60%', p: 0.8, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {previousBalance.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                {/* 후 잔액 */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: '40%', borderRight: 1, borderColor: 'divider', bgcolor: 'grey.100', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      후 잔액:
                    </Typography>
                  </Box>
                  <Box sx={{ width: '60%', p: 0.8, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'error.main' }}>
                      {currentBalance.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                {/* 금일수금액 */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: '40%', borderRight: 1, borderColor: 'divider', bgcolor: 'grey.100', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      금일수금액:
                    </Typography>
                  </Box>
                  <Box sx={{ width: '60%', p: 0.8, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      0
                    </Typography>
                  </Box>
                </Box>

                {/* 계좌번호 */}
                <Box sx={{ display: 'flex' }}>
                  <Box sx={{ width: '40%', borderRight: 1, borderColor: 'divider', bgcolor: 'grey.100', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      계좌번호:
                    </Typography>
                  </Box>
                  <Box sx={{ width: '60%', p: 0.8, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.65rem' }}>
                      {COMPANY_INFO.bankAccount}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* 우측 카드: 금액 정보 */}
              <Box sx={{ flex: 1, border: 1, borderColor: 'divider' }}>
                {/* 공급가액 */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: '40%', borderRight: 1, borderColor: 'divider', bgcolor: 'grey.100', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      공급가액:
                    </Typography>
                  </Box>
                  <Box sx={{ width: '60%', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {supplyAmount.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                {/* VAT */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: '40%', borderRight: 1, borderColor: 'divider', bgcolor: 'grey.100', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      VAT:
                    </Typography>
                  </Box>
                  <Box sx={{ width: '60%', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {vat.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                {/* 합계 */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: '40%', borderRight: 1, borderColor: 'divider', bgcolor: 'grey.100', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      합계:
                    </Typography>
                  </Box>
                  <Box sx={{ width: '60%', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      {ledger.totalAmount.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                {/* 인수 */}
                <Box sx={{ display: 'flex' }}>
                  <Box sx={{ width: '40%', borderRight: 1, borderColor: 'divider', bgcolor: 'grey.100', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      인수:
                    </Typography>
                  </Box>
                  <Box sx={{ width: '60%', p: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ flex: 1, borderBottom: 1, borderColor: 'divider', mx: 1, minHeight: '20px' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      (인)
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* 안내문 + 페이지 번호 */}
            <Box sx={{ display: 'flex', mt: 2, border: 1, borderColor: 'divider' }}>
            {/* 좌측: 안내문 (90%) */}
            <Box sx={{ width: '90%', p: 1, borderRight: 1, borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
                주문주신 제품의 본인 확인을 꼭! 부탁드립니다. 8월 15일: '유림떡' 휴무, 8월 15~16일: '만복' 휴무.
              </Typography>
            </Box>

            {/* 우측: 페이지 번호 (10%) */}
            <Box sx={{ width: '10%', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {currentPage} / {totalPages}
              </Typography>
            </Box>
          </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

  getTitle(data: SaleSlipData): string {
    return `${data.customer.businessName} - 거래명세서`;
  }

  getSummary(data: SaleSlipData): string {
    return data.ledger.saleLedgerNumber;
  }
}

export const SaleSlipRenderer = new SaleSlipRendererClass();
