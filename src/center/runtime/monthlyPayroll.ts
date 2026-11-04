import { daysInStoryMonth } from './mainlineStoryClock'

export const MONTHLY_SALARY_UNITS = 1_500

export type StoryDate = { year: number; month: number; day: number }
export type MonthlySalaryReceipt = {
  year: number
  month: number
  amount: number
  paidOnYear: number
  paidOnMonth: number
  paidOnDay: number
}
export type MonthlySalaryReceipts = Record<string, MonthlySalaryReceipt>

export function isValidStoryDate(value: unknown): value is StoryDate {
  if (!value || typeof value !== 'object') return false
  const date = value as Partial<StoryDate>
  return Number.isInteger(date.year) && date.year! > 0 && date.year! <= 9999
    && Number.isInteger(date.month) && date.month! >= 1 && date.month! <= 12
    && Number.isInteger(date.day) && date.day! >= 1 && date.day! <= daysInStoryMonth(date.year!, date.month!)
}

function compareStoryDates(left: StoryDate, right: StoryDate): number {
  return left.year - right.year || left.month - right.month || left.day - right.day
}

function payrollMonthKey(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

export function cleanMonthlySalaryReceipts(value: unknown): MonthlySalaryReceipts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const clean: MonthlySalaryReceipts = {}
  for (const [key, item] of Object.entries(value)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const receipt = item as Partial<MonthlySalaryReceipt>
    if (!Number.isInteger(receipt.year) || receipt.year! < 1 || receipt.year! > 9999 || !Number.isInteger(receipt.month) || receipt.month! < 1 || receipt.month! > 12) continue
    const expectedKey = payrollMonthKey(receipt.year!, receipt.month!)
    if (key !== expectedKey) continue
    if (!Number.isInteger(receipt.paidOnYear) || receipt.paidOnYear! < 1 || receipt.paidOnYear! > 9999
      || !Number.isInteger(receipt.paidOnMonth) || receipt.paidOnMonth! < 1 || receipt.paidOnMonth! > 12
      || !Number.isInteger(receipt.paidOnDay) || receipt.paidOnDay! < 1 || receipt.paidOnDay! > daysInStoryMonth(receipt.paidOnYear!, receipt.paidOnMonth!)) continue
    // Salary is an authored fixed amount; malformed or older amounts are not
    // trusted as another credit when a save is normalized.
    clean[key] = {
      year: receipt.year!, month: receipt.month!, amount: MONTHLY_SALARY_UNITS,
      paidOnYear: receipt.paidOnYear!, paidOnMonth: receipt.paidOnMonth!, paidOnDay: receipt.paidOnDay!,
    }
  }
  return clean
}

export function settleMonthlySalary(
  from: StoryDate,
  to: StoryDate,
  walletBalance: number,
  existingReceipts: MonthlySalaryReceipts,
): { walletBalance: number; receipts: MonthlySalaryReceipts; paidMonths: string[] } {
  if (!isValidStoryDate(from) || !isValidStoryDate(to) || compareStoryDates(to, from) <= 0) {
    return { walletBalance, receipts: existingReceipts, paidMonths: [] }
  }

  const receipts = { ...existingReceipts }
  const paidMonths: string[] = []
  let nextWalletBalance = walletBalance
  let year = from.year
  let month = from.month

  while (year < to.year || (year === to.year && month <= to.month)) {
    const monthEnd = { year, month, day: daysInStoryMonth(year, month) }
    if (compareStoryDates(from, monthEnd) < 0 && compareStoryDates(monthEnd, to) <= 0) {
      const key = payrollMonthKey(year, month)
      if (!Object.hasOwn(receipts, key)) {
        receipts[key] = {
          year, month, amount: MONTHLY_SALARY_UNITS,
          paidOnYear: monthEnd.year, paidOnMonth: monthEnd.month, paidOnDay: monthEnd.day,
        }
        nextWalletBalance += MONTHLY_SALARY_UNITS
        paidMonths.push(key)
      }
    }
    if (month === 12) { year += 1; month = 1 }
    else month += 1
  }

  return { walletBalance: nextWalletBalance, receipts, paidMonths }
}
