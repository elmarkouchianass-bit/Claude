require 'liquid'

# --- stubs for Shopify-only tags ------------------------------------------------
%w[schema stylesheet style javascript].each do |name|
  klass = Class.new(Liquid::Block) do
    def render_to_output_buffer(_ctx, output) = output
  end
  Liquid::Template.register_tag(name, klass)
end
doc = Class.new(Liquid::Block) { def render_to_output_buffer(_ctx, output) = output }
Liquid::Template.register_tag('doc', doc)
content_for = Class.new(Liquid::Tag) { def render_to_output_buffer(_ctx, output) = output << '<!--blocks-->' }
Liquid::Template.register_tag('content_for', content_for)

form_tag = Class.new(Liquid::Block) do
  def render_to_output_buffer(ctx, output)
    output << '<form method="post" action="/cart/add">'
    super
    output << '</form>'
  end
end
Liquid::Template.register_tag('form', form_tag)

module ShopifyFilters
  def t(key, args = {})
    args = {} unless args.is_a?(Hash)
    rendered = args.map { |k, v| "#{k}=#{v}" }.join(',')
    args.empty? ? "«#{key}»" : "«#{key} #{rendered}»"
  end
  def money(cents) = format('€ %.2f', cents.to_f / 100).tr('.', ',')
  def asset_url(name) = "//cdn.shopify.test/#{name}"
  def stylesheet_tag(url) = %(<link rel="stylesheet" href="#{url}">)
  def json(value) = value.to_json
end
require 'json'
Liquid::Template.register_filter(ShopifyFilters)

class DocStrippingFileSystem
  def read_template_file(path)
    src = File.read("snippets/#{path}.liquid")
    src.gsub(/\{%-?\s*doc\s*-?%\}.*?\{%-?\s*enddoc\s*-?%\}/m, '')
  end
end
Liquid::Template.file_system = DocStrippingFileSystem.new

# Shopify's {% render %} exposes the global objects (settings, cart, routes) to the snippet.
# The Liquid gem's render tag isolates everything, so the shared-scope include tag is the
# closer stand-in for this harness.
Liquid::Template.register_tag('render', Liquid::Include)

# --- fixtures -------------------------------------------------------------------
SETTINGS = begin
  s = { 'vor_ladder_enabled' => true, 'vor_ladder_apply_codes' => true, 'vor_accent_color' => '#A34426' }
  [[2, 10, 'BUNDEL10'], [3, 15, 'BUNDEL15'], [4, 20, 'BUNDEL20'], [5, 25, 'BUNDEL25']].each_with_index do |(q, p, c), i|
    s["vor_ladder_qty_#{i + 1}"] = q; s["vor_ladder_percent_#{i + 1}"] = p; s["vor_ladder_code_#{i + 1}"] = c
  end
  (5..6).each { |i| s["vor_ladder_qty_#{i}"] = 0; s["vor_ladder_percent_#{i}"] = 0; s["vor_ladder_code_#{i}"] = '' }
  s
end

def block(settings = {})
  { 'id' => 'test-block', 'shopify_attributes' => 'data-shopify-editor-block', 'settings' => settings }
end

def cart(count, discount = 0)
  { 'item_count' => count, 'total_discount' => discount, 'currency' => { 'iso_code' => 'EUR' } }
end

def render(path, assigns)
  src = File.read(path).gsub(/\{%-?\s*doc\s*-?%\}.*?\{%-?\s*enddoc\s*-?%\}/m, '')
  template = Liquid::Template.parse(src)
  out = template.render(assigns, strict_variables: false)
  raise "ERRORS in #{path}: #{template.errors.inspect}" if template.errors.any?
  out
end

failures = 0
def report(label, output, must_include: [], must_exclude: [])
  problems = must_include.reject { |needle| output.include?(needle) }.map { |n| "missing #{n.inspect}" }
  problems += must_exclude.select { |needle| output.include?(needle) }.map { |n| "unexpected #{n.inspect}" }
  puts(problems.empty? ? "ok    #{label}" : "FAIL  #{label}: #{problems.join(', ')}\n#{output}")
  problems.empty?
end

padding = { 'padding-block-start' => 8, 'padding-block-end' => 0,
            'padding-inline-start' => 0, 'padding-inline-end' => 0 }

# --- ladder bar -----------------------------------------------------------------
out = render('blocks/vor-ladder-bar.liquid',
             'settings' => SETTINGS, 'cart' => cart(2),
             'block' => block(padding.merge('show_progress' => true, 'position_mobile' => 'sticky')))
failures += 1 unless report('ladder bar, cart of 2 -> 1 item to go, 66%', out,
                            must_include: ['«vor.ladder.progress count=1,percent=15»', '--vor-progress: 66%',
                                           'aria-valuenow="66"'],
                            must_exclude: ['hidden'])

out = render('blocks/vor-ladder-bar.liquid',
             'settings' => SETTINGS, 'cart' => cart(0),
             'block' => block(padding.merge('show_progress' => true, 'position_mobile' => 'sticky')))
failures += 1 unless report('ladder bar hides on an empty cart', out, must_include: ['hidden'])

out = render('blocks/vor-ladder-bar.liquid',
             'settings' => SETTINGS, 'cart' => cart(6),
             'block' => block(padding.merge('show_progress' => true, 'position_mobile' => 'inline')))
failures += 1 unless report('ladder bar at the top tier', out,
                            must_include: ['«vor.ladder.max_reached percent=25»', '--vor-progress: 100%'])

# --- ladder line ----------------------------------------------------------------
out = render('blocks/vor-ladder-line.liquid',
             'settings' => SETTINGS, 'cart' => cart(0),
             'block' => block(padding.merge('alignment' => 'left')))
failures += 1 unless report('ladder line lists every tier', out,
                            must_include: ['«vor.ladder.tier count=2,percent=10»',
                                           '«vor.ladder.tier_short count=3,percent=15»',
                                           '«vor.ladder.tier_short count=4,percent=20»',
                                           '«vor.ladder.tier_short_max count=5,percent=25»'])

# --- full ladder ----------------------------------------------------------------
out = render('blocks/vor-volume-ladder.liquid',
             'settings' => SETTINGS, 'cart' => cart(3, 1299),
             'block' => block('show_saved' => true, 'show_note' => true, 'hide_when_empty' => true,
                              'padding-block-start' => 16, 'padding-block-end' => 16,
                              'padding-inline-start' => 0, 'padding-inline-end' => 0))
failures += 1 unless report('full ladder marks the active tier and shows what Shopify calculated', out,
                            must_include: ['data-vor-active-index="2"', 'vor-ladder__tier--active',
                                           'aria-current="true"', '«vor.ladder.saved amount=€ 12,99»',
                                           '«vor.ladder.tier_max count=5,percent=25»'])

out = render('blocks/vor-volume-ladder.liquid',
             'settings' => SETTINGS, 'cart' => cart(0),
             'block' => block('show_saved' => true, 'show_note' => true, 'hide_when_empty' => true,
                              'padding-block-start' => 16, 'padding-block-end' => 16,
                              'padding-inline-start' => 0, 'padding-inline-end' => 0))
failures += 1 unless report('full ladder hides on an empty cart', out, must_exclude: ['vor-ladder__tiers'])

# --- size fit -------------------------------------------------------------------
product_with_fit = { 'metafields' => { 'custom' => { 'size_fit' => { 'value' => 4 } } } }
out = render('blocks/vor-size-fit.liquid',
             'settings' => SETTINGS, 'closest' => { 'product' => product_with_fit },
             'block' => block('fallback_value' => 3, 'padding-block-start' => 0, 'padding-block-end' => 0,
                              'padding-inline-start' => 0, 'padding-inline-end' => 0))
failures += 1 unless report('size fit reads the metafield', out,
                            must_include: ['--vor-fit-offset: 75%', '«vor.size_fit.scale_large»'])

out = render('blocks/vor-size-fit.liquid',
             'settings' => SETTINGS, 'closest' => { 'product' => { 'metafields' => {} } },
             'block' => block('fallback_value' => 2, 'padding-block-start' => 0, 'padding-block-end' => 0,
                              'padding-inline-start' => 0, 'padding-inline-end' => 0))
failures += 1 unless report('size fit falls back to the block setting', out,
                            must_include: ['--vor-fit-offset: 25%', '«vor.size_fit.scale_small»'])

# --- usp + review ---------------------------------------------------------------
out = render('blocks/vor-usp-list.liquid', 'settings' => SETTINGS,
             'block' => block(padding.merge('heading' => 'Goed om te weten', 'columns' => 4)))
failures += 1 unless report('usp list renders a list with room for its items', out,
                            must_include: ['vor-list', '<!--blocks-->', 'Goed om te weten'])

out = render('blocks/_vor-usp-item.liquid', 'block' => block('text' => '30 dagen retour'))
failures += 1 unless report('usp item', out, must_include: ['vor-list__item', '30 dagen retour'])

out = render('blocks/vor-review.liquid',
             'block' => block(padding.merge('quote' => 'Zit goed.', 'author' => 'Thomas', 'product_name' => 'Wollen jas')))
failures += 1 unless report('review', out, must_include: ['Zit goed.', 'Thomas', '«vor.review.about product=Wollen jas»'])

# --- card size strip ------------------------------------------------------------
size_product = {
  'id' => 42, 'title' => 'Wollen jas',
  'options' => [1], 'has_only_default_variant' => false,
  'options_with_values' => [{ 'name' => 'Maat',
                              'values' => [{ 'available' => true, 'variant' => { 'id' => 111 } },
                                           { 'available' => false, 'variant' => { 'id' => 222 } }] }]
}
out = render('snippets/vor-card-size-add.liquid',
             'product' => size_product, 'option_name' => 'Maat',
             'form' => nil)
failures += 1 unless report('card size strip renders radios for a single option product', out,
                            must_include: ['vor-card-size-add', 'data-variant-id="111"',
                                           'vor-card-sizes__option--unavailable', 'ref="variantId"'])

multi_option = size_product.merge('options' => [1, 2])
out = render('snippets/vor-card-size-add.liquid', 'product' => multi_option, 'option_name' => 'Maat')
failures += 1 unless report('card size strip stays out of the way for multi option products', out,
                            must_exclude: ['vor-card-size-add'])


# --- brand block: the ladder config has to be parseable JSON -------------------
out = render('blocks/vor-brand.liquid',
             'settings' => SETTINGS.merge('vor_accent_color' => '#A34426'),
             'cart' => cart(3, 1299),
             'shop' => { 'money_format' => '€ {{amount_with_comma_separator}}' },
             'routes' => { 'cart_update_url' => '/cart/update', 'cart_url' => '/cart' },
             'block' => block)
json_body = out[/<script type="application\/json" id="vor-ladder-config">(.*?)<\/script>/m, 1]
begin
  parsed = JSON.parse(json_body.to_s)
  tiers = parsed['tiers']
  problems = []
  problems << 'four tiers expected' unless tiers.is_a?(Array) && tiers.size == 4
  problems << 'codes missing' unless tiers.map { |t| t['code'] } == %w[BUNDEL10 BUNDEL15 BUNDEL20 BUNDEL25]
  problems << 'last tier not flagged' unless tiers.last['isLast'] == true && tiers.first['isLast'] == false
  problems << 'progress keys missing' unless tiers[1]['progress'].keys.sort == %w[1 2 3]
  problems << 'cart state missing' unless parsed['cart'] == { 'itemCount' => 3, 'totalDiscount' => 1299 }
  problems << 'saved template missing placeholder' unless parsed['strings']['saved'].include?('__VOR_AMOUNT__')
  puts(problems.empty? ? 'ok    brand block emits valid ladder JSON' : "FAIL  brand block: #{problems.join(', ')}")
  failures += 1 unless problems.empty?
rescue JSON::ParserError => e
  puts "FAIL  brand block emits invalid JSON: #{e.message}"
  puts json_body.to_s[0, 600]
  failures += 1
end


# --- breadcrumbs ---------------------------------------------------------------
out = render('snippets/vor-breadcrumb-jsonld.liquid',
             'template' => { 'name' => 'product' },
             'request' => { 'origin' => 'https://vorreni.nl' },
             'routes' => { 'root_url' => '/' },
             'collection' => nil,
             'product' => { 'title' => 'Wollen jas', 'url' => '/products/wollen-jas',
                            'collections' => [{ 'title' => 'Jassen', 'url' => '/collections/jassen' }] })
begin
  crumbs = JSON.parse(out[/<script type="application\/ld\+json">(.*?)<\/script>/m, 1].to_s)
  positions = crumbs['itemListElement'].map { |i| [i['position'], i['name']] }
  expected = [[1, '«vor.breadcrumb.home»'], [2, 'Jassen'], [3, 'Wollen jas']]
  ok = crumbs['@type'] == 'BreadcrumbList' && positions == expected
  puts(ok ? 'ok    breadcrumbs on a product page' : "FAIL  breadcrumbs: #{positions.inspect}")
  failures += 1 unless ok
rescue JSON::ParserError => e
  puts "FAIL  breadcrumb JSON invalid: #{e.message}"; failures += 1
end

out = render('snippets/vor-breadcrumb-jsonld.liquid',
             'template' => { 'name' => 'index' }, 'request' => { 'origin' => 'https://vorreni.nl' },
             'routes' => { 'root_url' => '/' })
failures += 1 unless report('no breadcrumbs outside product and collection pages', out, must_exclude: ['BreadcrumbList'])

puts failures.zero? ? "\nALL PASS" : "\n#{failures} FAILURES"
exit(failures.zero? ? 0 : 1)
