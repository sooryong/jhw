/**
 * 파일 경로: /src/utils/smsTemplates.ts
 * 작성 날짜: 2025-10-05
 * 주요 내용: SMS 메시지 템플릿 생성 유틸리티
 */

import type { PurchaseOrder } from '../types/purchaseOrder';

/**
 * 매입주문 SMS 메시지 생성 (간결한 포맷)
 */
export const generatePurchaseOrderMessage = (purchaseOrder: PurchaseOrder): string => {
  // 상품 목록 생성 (<상품명 (규격): 수량> 형식)
  const itemList = purchaseOrder.orderItems
    .map(item => {
      const productName = item.productName;
      const spec = item.specification ? ` (${item.specification})` : '';
      const quantity = item.quantity.toLocaleString('ko-KR');
      return `<${productName}${spec}: ${quantity}>`;
    })
    .join('\n');

  // 총 수량 계산
  const totalQuantity = purchaseOrder.orderItems
    .reduce((sum, item) => sum + item.quantity, 0);

  return `[진현유통 매입주문]
${purchaseOrder.supplierInfo.businessName}님
${itemList}
합계수량: ${totalQuantity.toLocaleString('ko-KR')}개

확인 후 회신 부탁드립니다.
02-2676-8600`;
};
