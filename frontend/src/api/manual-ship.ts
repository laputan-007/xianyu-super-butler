import { post } from '@/utils/request'

export interface VerifyAllOrdersResponse {
  success: boolean
  message?: string
  total: number
  success_count: number
  failed_count: number
}

export interface ManualShipResponse {
  success: boolean
  message?: string
  total: number
  success_count: number
  failed_count: number
  results: Array<{
    order_id: string
    success: boolean
    message: string
  }>
}

// 全量核对所有订单数据
export const verifyAllOrders = async (): Promise<VerifyAllOrdersResponse> => {
  try {
    const result = await post<VerifyAllOrdersResponse>('/api/orders/verify-all', {})
    return result
  } catch (error) {
    console.error('核对订单数据失败:', error)
    return {
      success: false,
      message: '核对订单数据失败',
      total: 0,
      success_count: 0,
      failed_count: 0
    }
  }
}

// 手动补发货
export const manualShipOrders = async (
  orderIds: string[],
  shipMode: 'auto_match' | 'custom',
  customContent?: string
): Promise<ManualShipResponse> => {
  try {
    const result = await post<ManualShipResponse>('/api/orders/manual-ship', {
      order_ids: orderIds,
      ship_mode: shipMode,
      custom_content: customContent
    })
    return result
  } catch (error) {
    console.error('手动发货失败:', error)
    return {
      success: false,
      message: '手动发货失败',
      total: orderIds.length,
      success_count: 0,
      failed_count: orderIds.length,
      results: []
    }
  }
}
