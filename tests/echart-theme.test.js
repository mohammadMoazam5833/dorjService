import test from 'node:test'
import assert from 'node:assert/strict'
import { CHART_COLORS, formatChartNumber, formatChartTime, toChartDigits, withChartTheme } from '../src/lib/echart-theme.js'

test('chart palette follows the Dorj series order', () => {
  assert.deepEqual(CHART_COLORS, ['#2747B8', '#5B8CFF', '#E8A317', '#2BB6A8', '#8B7CF6', '#E76A5E'])
})

test('chart number formatting abbreviates large values and localizes digits', () => {
  assert.equal(formatChartNumber(12_345), '12.3k')
  assert.equal(formatChartNumber(1_234), '1,234')
  assert.equal(formatChartNumber(1_234, { lang: 'fa', digits: 'persian' }), '۱,۲۳۴')
  assert.equal(toChartDigits('12:30', { lang: 'fa', digits: 'persian' }), '۱۲:۳۰')
})

test('chart time uses clock labels under a day and calendar dates over it', () => {
  const d = new Date(2026, 9, 8, 9, 5)
  const t = d.getTime() / 1000
  assert.equal(formatChartTime(t, {}, false), '09:05')
  assert.equal(formatChartTime(t, {}, true), '10/08')
})

test('theme normalizes axes, tooltip, animation and line gradients', () => {
  const option = withChartTheme({
    xAxis: { type: 'category', data: ['a1'] },
    yAxis: { type: 'value' },
    legend: { data: ['requests'] },
    series: [{ type: 'line', data: [1, 2] }],
  }, { lang: 'fa', digits: 'persian' })
  assert.equal(option.animationDuration <= 480, true)
  assert.equal(option.tooltip.trigger, 'axis')
  assert.equal(typeof option.tooltip.formatter, 'function')
  assert.equal(typeof option.xAxis.axisLabel.formatter, 'function')
  assert.equal(typeof option.legend.formatter, 'function')
  assert.match(option.series[0].areaStyle.color.colorStops[0].color, /^#2747B8/)
})
