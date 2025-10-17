/**
 * 파일 경로: /src/pages/suppliers/SupplierLedgerPage.tsx
 * 작성 날짜: 2025-10-16
 * 주요 내용: 공급사 원장 통합 페이지 (지급, 미지급금, 거래처원장)
 */

import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import {
  AccountBalance as LedgerIcon
} from '@mui/icons-material';
import SupplierPaymentListPage from '../supplier-payments/SupplierPaymentListPage';
import SupplierAccountListPage from './SupplierAccountListPage';
import SupplierStatementPage from './SupplierStatementPage';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`supplier-ledger-tabpanel-${index}`}
      aria-labelledby={`supplier-ledger-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const SupplierLedgerPage = () => {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
        <LedgerIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <div>
          <Typography variant="h4" component="h1" gutterBottom>
            공급사 원장
          </Typography>
          <Typography variant="body2" color="text.secondary">
            지급, 미지급금, 거래처원장 통합 관리
          </Typography>
        </div>
      </Box>

      {/* 탭 */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          aria-label="공급사 원장 탭"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="지급 내역" />
          <Tab label="미지급금 현황" />
          <Tab label="거래처원장 조회" />
        </Tabs>
      </Paper>

      {/* 탭 내용 */}
      <TabPanel value={currentTab} index={0}>
        <SupplierPaymentListPage embedded />
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        <SupplierAccountListPage embedded />
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        <SupplierStatementPage embedded />
      </TabPanel>
    </Container>
  );
};

export default SupplierLedgerPage;
