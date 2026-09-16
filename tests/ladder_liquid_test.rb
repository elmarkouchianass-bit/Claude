require 'liquid'

def strip_doc(src)
  src.gsub(/\{%-?\s*doc\s*-?%\}.*?\{%-?\s*enddoc\s*-?%\}/m, '')
end

ROWS = Liquid::Template.parse(strip_doc(File.read('snippets/vor-ladder-rows.liquid')))
STATE = Liquid::Template.parse(strip_doc(File.read('snippets/vor-ladder-state.liquid')))

def settings_for(tiers)
  s = {}
  (1..6).each { |i| s["vor_ladder_qty_#{i}"] = 0; s["vor_ladder_percent_#{i}"] = 0; s["vor_ladder_code_#{i}"] = '' }
  tiers.each_with_index do |(qty, pct, code), i|
    s["vor_ladder_qty_#{i + 1}"] = qty
    s["vor_ladder_percent_#{i + 1}"] = pct
    s["vor_ladder_code_#{i + 1}"] = code
  end
  s
end

def rows_for(tiers)
  ROWS.render('settings' => settings_for(tiers)).strip
end

def state_for(tiers, count)
  STATE.render('rows' => rows_for(tiers), 'cart' => { 'item_count' => count }).strip
end

failures = 0
def check(label, actual, expected)
  ok = actual == expected
  puts "#{ok ? 'ok  ' : 'FAIL'}  #{label}: #{actual}#{ok ? '' : "  (expected #{expected})"}"
  ok
end

DEFAULT = [[2, 10, 'BUNDEL10'], [3, 15, 'BUNDEL15'], [4, 20, 'BUNDEL20'], [5, 25, 'BUNDEL25']]

puts "-- rows"
failures += 1 unless check('default rows', rows_for(DEFAULT),
  '002|2|10|BUNDEL10,003|3|15|BUNDEL15,004|4|20|BUNDEL20,005|5|25|BUNDEL25')
failures += 1 unless check('rows entered out of order', rows_for([[5, 25, 'B25'], [2, 10, 'B10'], [12, 30, 'B30']]),
  '002|2|10|B10,005|5|25|B25,012|12|30|B30')
failures += 1 unless check('rows with a disabled tier', rows_for([[2, 10, 'B10'], [0, 15, 'B15'], [4, 20, 'B20']]),
  '002|2|10|B10,004|4|20|B20')
failures += 1 unless check('no tiers configured', rows_for([]), '')

puts "-- state (itemCount|active|next|remaining)"
{ 0 => '0|0|1|2', 1 => '1|0|1|1', 2 => '2|1|2|1', 3 => '3|2|3|1',
  4 => '4|3|4|1', 5 => '5|4|0|0', 7 => '7|4|0|0' }.each do |count, expected|
  failures += 1 unless check("cart with #{count}", state_for(DEFAULT, count), expected)
end

puts failures.zero? ? "\nALL PASS" : "\n#{failures} FAILURES"
exit(failures.zero? ? 0 : 1)
