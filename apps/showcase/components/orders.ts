export interface Order {
  id: string
  customer: string
  item: string
  amount: number
  status: '접수' | '배송 중' | '완료' | '취소'
}

const CUSTOMERS = ['한빛상사', '가온물산', '누리테크', '다온유통', '라온식품', '마루건설']
const ITEMS = ['A4 용지', '토너', '모니터', '키보드', '사무용 의자', '노트북 거치대']
const STATUS: Order['status'][] = ['접수', '배송 중', '완료', '취소']

export const ORDERS: Order[] = Array.from({ length: 60 }, (_, i) => ({
  id: `SO-${String(24001 + i)}`,
  customer: CUSTOMERS[i % CUSTOMERS.length]!,
  item: ITEMS[(i * 7) % ITEMS.length]!,
  amount: 12000 + ((i * 7919) % 480) * 1000,
  status: STATUS[(i * 3) % STATUS.length]!,
}))

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
