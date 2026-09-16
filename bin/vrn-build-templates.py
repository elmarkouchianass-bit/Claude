"""Bouwt de Vorreni-templates opnieuw op. Draai vanuit de theme-root:

    python3 bin/vrn-build-templates.py

Bewerk de templates bij voorkeur hier en niet met de hand in templates/*.json,
zodat de blockstructuur blijft kloppen met wat elke Horizon-sectie verwacht.

 Start waar mogelijk vanaf Horizon's eigen
presets, zodat de blockstructuur klopt met wat de sectie verwacht."""
import copy, json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def schema(section):
    s = open(os.path.join(ROOT, 'sections', f'{section}.liquid')).read()
    return json.loads(re.search(r'\{%\s*schema\s*%\}(.*?)\{%\s*endschema\s*%\}', s, re.S).group(1))

def preset(section, name):
    """Kopie van een preset van een Horizon-sectie, als sectie-definitie."""
    for p in schema(section).get('presets', []):
        if p.get('name') == name:
            out = {'type': section, 'settings': copy.deepcopy(p.get('settings', {}))}
            if 'blocks' in p:
                out['blocks'] = copy.deepcopy(p['blocks'])
                out['block_order'] = copy.deepcopy(p.get('block_order') or list(p['blocks'].keys()))
            return out
    raise SystemExit(f'preset {name!r} niet gevonden in {section}')

def text(html, **settings):
    return {'type': 'text', 'settings': {'text': html, **settings}}

def at(node, path):
    """Loopt door een geneste blocks-boom: at(sec, 'content/group/heading')."""
    for key in path.split('/'):
        node = node['blocks'][key] if 'blocks' in node else node[key]
    return node

def write(name, sections, order):
    path = os.path.join(ROOT, 'templates', name)
    with open(path, 'w') as f:
        json.dump({'sections': sections, 'order': order}, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('  ', name)

print('templates:')

USP = {
    'usp_returns':  ('30 dagen retourrecht', 'Past niet? Stuur het gratis terug.'),
    'usp_shipping': ('Gratis verzending vanaf € 75', 'Daaronder € 4,95 binnen Nederland.'),
    'usp_fast':     ('Besteld voor 22:00, morgen verzonden', 'Op werkdagen.'),
    'usp_service':  ('Klantenservice in Nederland', 'Op werkdagen bereikbaar van 9 tot 17 uur.'),
}

def usp_list(**settings):
    return {
        'type': 'vrn-usp-list',
        'settings': {'columns': 4, 'padding-block-start': 32, 'padding-block-end': 32, **settings},
        'blocks': {k: {'type': 'vrn-usp-item', 'settings': {'title': t, 'body': b}}
                   for k, (t, b) in USP.items()},
        'block_order': list(USP),
    }

# ---------------------------------------------------------------- index -----
hero = preset('media-with-content', 't:names.editorial')
hero['settings'].update({'media_position': 'left', 'media_width': 'wide',
                         'media_height': '80svh', 'section_width': 'full-width'})
at(hero, 'content/caption')['settings']['text'] = '<p>Najaar 2026</p>'
at(hero, 'content/group/heading')['settings'].update(
    {'text': '<h1>Gemaakt om te dragen</h1>', 'type_preset': 'h1'})
at(hero, 'content/group/text')['settings']['text'] = (
    '<p>Jassen, knitwear en broeken van wol, katoen en canvas. '
    'Gemaakt om jaren mee te gaan, niet één seizoen.</p>')
at(hero, 'content/button')['settings'].update(
    {'label': 'Shop de collectie', 'link': 'shopify://collections/all', 'style_class': 'button'})

tiles = preset('collection-list', 't:names.collections_grid')
tiles['settings'].update({'columns': 4, 'max_collections': 4, 'mobile_columns': '2',
                          'padding-block-start': 56, 'padding-block-end': 56})

featured = preset('product-list', 't:names.products_grid')
featured['settings'].update({'max_products': 4, 'columns': 4, 'mobile_columns': '2',
                             'padding-block-start': 0, 'padding-block-end': 56})

usp_section = {
    'type': 'section',
    'settings': {'section_width': 'page-width', 'content_direction': 'column',
                 'padding-block-start': 0, 'padding-block-end': 24},
    'blocks': {'usp': usp_list()},
    'block_order': ['usp'],
}

editorial = preset('media-with-content', 't:names.editorial')
editorial['settings'].update({'media_position': 'right', 'media_width': 'medium',
                              'media_height': '60svh', 'section_width': 'full-width'})
at(editorial, 'content/caption')['settings']['text'] = '<p>Over Vorreni</p>'
at(editorial, 'content/group/heading')['settings'].update(
    {'text': '<h2>Eén jas, tien winters</h2>', 'type_preset': 'h2'})
at(editorial, 'content/group/text')['settings']['text'] = (
    '<p>We kiezen de stof voordat we een pasvorm kiezen. Merinowol uit Biella, '
    'canvas uit Japan, katoen dat zachter wordt in plaats van dunner. De snit is '
    'recht en ruim genoeg om er een trui onder te dragen, want daar is een jas voor. '
    'Vorreni bestaat omdat goede herenkleding niet elk seizoen opnieuw uitgevonden '
    'hoeft te worden.</p>')
at(editorial, 'content/button')['settings'].update(
    {'label': 'Lees ons verhaal', 'link': 'shopify://pages/over-ons', 'style_class': 'button-unstyled'})

REVIEWS = [
    ('Zit als gegoten en de wol voelt zwaar aan, in de goede zin.', 'Daan', 'Wollen overshirt'),
    ('Derde winter met deze jas. Nog geen enkele naad losgelaten.', 'Joris', 'Canvas parka'),
    ('Eindelijk een broek die lang genoeg is zonder te wijd te zitten.', 'Sem', 'Katoenen chino'),
]

reviews_section = {
    'type': 'section',
    'settings': {'section_width': 'page-width', 'content_direction': 'row',
                 'vertical_on_mobile': True, 'gap': 32, 'vertical_alignment': 'flex-start',
                 'padding-block-start': 56, 'padding-block-end': 56},
    'blocks': {f'review_{i}': {'type': 'vrn-review',
                               'settings': {'quote': q, 'name': n, 'product': p}}
               for i, (q, n, p) in enumerate(REVIEWS, 1)},
    'block_order': [f'review_{i}' for i in range(1, len(REVIEWS) + 1)],
}

write('index.json', {
    'hero': hero,
    'categories': tiles,
    'featured': featured,
    'usp': usp_section,
    'editorial': editorial,
    'reviews': reviews_section,
}, ['hero', 'categories', 'featured', 'usp', 'editorial', 'reviews'])

# -------------------------------------------------------------- product -----
def mf(key, fallback, use_description=False):
    return {'type': 'vrn-metafield-text',
            'settings': {'namespace': 'custom', 'key': key, 'fallback': fallback,
                         'use_description': use_description}}

def row(heading, child, open_by_default=False):
    return {'type': '_accordion-row',
            'settings': {'heading': heading, 'open_by_default': open_by_default},
            'blocks': {'body': child}, 'block_order': ['body']}

accordion_rows = {
    'row_description': row('Productomschrijving',
                           {'type': 'product-description', 'settings': {'type_preset': 'rte'}},
                           open_by_default=True),
    'row_material': row('Materiaal & onderhoud', mf('material_care',
        '<p>Vul per product het metafield custom.material_care met samenstelling en wasvoorschrift.</p>')),
    'row_shipping': row('Verzending', mf('shipping',
        '<p>Besteld voor 22:00 op werkdagen, dezelfde dag verzonden. Gratis vanaf € 75, '
        'daaronder € 4,95 binnen Nederland. België € 6,95.</p>')),
    'row_returns': row('Retourneren', mf('returns',
        '<p>30 dagen bedenktijd. Ongedragen en met het label eraan retourneren is gratis; '
        'je krijgt het aankoopbedrag binnen vijf werkdagen na ontvangst terug.</p>')),
    'row_size_chart': row('Maattabel', mf('size_chart',
        '<p>Vul het metafield custom.size_chart met de maattabel van dit product.</p>')),
}

product_details_blocks = {
    'breadcrumb': {'type': 'vrn-breadcrumb', 'settings': {'padding-block-end': 8}},
    'title': {'type': 'text', 'settings': {
        'text': '<h1>{{ closest.product.title }}</h1>', 'type_preset': 'h2', 'alignment': 'left'}},
    'price': {'type': 'price', 'settings': {
        'type_preset': 'h5', 'alignment': 'left', 'show_tax_info': False,
        'show_sale_price_first': True}},
    'size_fit': {'type': 'vrn-size-fit', 'settings': {
        'fallback_value': 3, 'show_label': True,
        'padding-block-start': 16, 'padding-block-end': 8}},
    'variant_picker': {'type': 'variant-picker', 'settings': {
        'variant_style': 'buttons', 'show_swatches': True,
        'padding-block-start': 0, 'padding-block-end': 4}},
    'size_guide': {
        'type': 'popup-link',
        'settings': {'heading': 'Maattabel', 'behavior': 'modal', 'type_preset': 'h6',
                     'padding-block-start': 0, 'padding-block-end': 12},
        'blocks': {'chart': mf('size_chart',
            '<p>Vul het metafield custom.size_chart met de maattabel van dit product.</p>')},
        'block_order': ['chart'],
    },
    'buy_buttons': {
        'type': 'buy-buttons',
        'settings': {'show_pickup_availability': True,
                     'padding-block-start': 0, 'padding-block-end': 0},
        'blocks': {
            'add-to-cart': {'type': 'add-to-cart', 'static': True,
                            'settings': {'style_class': 'button'}},
            'accelerated-checkout': {'type': 'accelerated-checkout', 'static': True},
        },
        'block_order': [],
    },
    'discount_line': {'type': 'vrn-discount-line', 'settings': {
        'padding-block-start': 8, 'padding-block-end': 16}},
    'usp': usp_list(columns=1, **{'padding-block-start': 8, 'padding-block-end': 16}),
    'accordion': {
        'type': 'accordion',
        'settings': {'icon': 'plus', 'dividers': True, 'type_preset': 'h6'},
        'blocks': accordion_rows,
        'block_order': list(accordion_rows),
    },
}

product_main = {
    'type': 'product-information',
    'settings': {
        'content_width': 'content-center-aligned',
        'desktop_media_position': 'left',
        'equal_columns': False,
        'gap': 32,
        'enable_sticky_add_to_cart': True,
        'padding-block-start': 16,
        'padding-block-end': 48,
    },
    'blocks': {
        'media-gallery': {'type': '_product-media-gallery', 'static': True, 'settings': {
            'media_presentation': 'grid', 'media_columns': 'one', 'image_gap': 4,
            'large_first_image': False, 'slideshow_controls_style': 'counter',
            'slideshow_mobile_controls_style': 'thumbnails', 'thumbnail_position': 'bottom',
            'thumbnail_width': 56, 'thumbnail_radius': 0, 'aspect_ratio': 'adapt',
            'media_fit': 'contain', 'media_radius': 0, 'zoom': True, 'video_loop': False,
            'hide_variants': True}},
        'product-details': {'type': '_product-details', 'static': True, 'settings': {
            'width': 'fill', 'height': 'fit', 'details_position': 'flex-start', 'gap': 4,
            'sticky_details_desktop': True, 'border': 'none',
            'padding-block-start': 8, 'padding-block-end': 24},
            'blocks': product_details_blocks,
            'block_order': list(product_details_blocks)},
    },
    'block_order': [],
}

recommendations = {
    'type': 'product-recommendations',
    'settings': {'recommendation_type': 'related', 'layout_type': 'grid', 'max_products': 4,
                 'carousel_on_mobile': True, 'padding-block-start': 32, 'padding-block-end': 64},
    'blocks': {'heading': {'type': 'text', 'settings': {
        'text': '<h2>Je zou ook leuk vinden</h2>', 'type_preset': 'h3'}}},
    'block_order': ['heading'],
}

write('product.json', {'main': product_main, 'recommendations': recommendations},
      ['main', 'recommendations'])

# ----------------------------------------------------------- collection -----
collection_header = {
    'type': 'section',
    'settings': {'section_width': 'page-width', 'content_direction': 'column', 'gap': 4,
                 'padding-block-start': 24, 'padding-block-end': 8},
    'blocks': {
        'breadcrumb': {'type': 'vrn-breadcrumb', 'settings': {'padding-block-end': 4}},
        'title': {'type': 'collection-title', 'settings': {'type_preset': 'h2'}},
    },
    'block_order': ['breadcrumb', 'title'],
}

collection_main = {
    'type': 'vrn-collection-grid',
    'settings': {'layout_type': 'grid', 'product_card_size': 'medium',
                 'mobile_product_card_size': 'small', 'enable_infinite_scroll': False,
                 'products_per_page': 24, 'product_grid_width': 'centered',
                 'full_width_on_mobile': False,
                 'columns_gap_horizontal': 16, 'columns_gap_vertical': 32,
                 'padding-block-start': 8, 'padding-block-end': 64},
    'blocks': {
        'filters': {'type': 'filters', 'static': True, 'settings': {
            'enable_filtering': True, 'enable_sorting': True, 'filter_style': 'horizontal'}},
        'product-card': {'type': 'vrn-product-card', 'static': True,
                         'settings': {'product_card_gap': 10, 'border_radius': 0},
                         'blocks': {
                             'gallery': {'type': '_product-card-gallery', 'settings': {}},
                             'sizes': {'type': 'vrn-size-strip',
                                       'settings': {'option_names': 'Maat,Size'}},
                             'title': {'type': 'product-title', 'settings': {'type_preset': 'h6', 'case': 'none'}},
                             'price': {'type': 'price', 'settings': {'type_preset': 'paragraph'}},
                         },
                         'block_order': ['gallery', 'sizes', 'title', 'price']},
    },
    'block_order': [],
}

write('collection.json', {
    'header': collection_header,
    'ladder': {'type': 'vrn-ladder-bar', 'settings': {'section_width': 'page-width'}},
    'main': collection_main,
}, ['header', 'ladder', 'main'])

# ---------------------------------------------------------------- cart ------
cart_main = {
    'type': 'main-cart',
    'settings': {'section_width': 'page-width',
                 'padding-block-start': 32, 'padding-block-end': 48},
    'blocks': {
        'cart-page-title': {'type': '_cart-title', 'static': True, 'settings': {}},
        'cart-page-items': {'type': '_cart-products', 'static': True, 'settings': {}},
        'cart-page-summary': {'type': '_cart-summary', 'static': True, 'settings': {}},
        # main-cart rendert vrije blocks na de samenvatting; dat is de enige plek
        # waar de sectie ze aanbiedt.
        'ladder': {'type': 'vrn-ladder', 'settings': {
            'show_heading': True, 'padding-block-start': 24, 'padding-block-end': 8}},
        'usp': usp_list(columns=4, **{'padding-block-start': 24, 'padding-block-end': 0}),
    },
    'block_order': ['ladder', 'usp'],
}

cart_cross_sell = preset('product-list', 't:names.products_grid')
cart_cross_sell['settings'].update({'max_products': 4, 'columns': 4, 'mobile_columns': '2',
                                    'padding-block-start': 32, 'padding-block-end': 64})

write('cart.json', {'cart': cart_main, 'cross_sell': cart_cross_sell},
      ['cart', 'cross_sell'])

# ------------------------------------------------------------- contact -----
contact_intro = {
    'type': 'main-page',
    'settings': {'content_direction': 'column', 'gap': 8,
                 'padding-block-start': 40, 'padding-block-end': 8},
    'blocks': {
        'title': text('<h1>Contact</h1>', type_preset='h2', alignment='left'),
        'intro': text(
            '<p>Vraag over een bestelling, een maat of een retour? Mail ons en je hebt '
            'op werkdagen binnen één werkdag antwoord. Bellen kan ook, van 9 tot 17 uur.</p>',
            type_preset='rte', max_width='narrow', alignment='left'),
    },
    'block_order': ['title', 'intro'],
}

contact_form = preset('section', 't:names.contact_form')
contact_form['settings'].update({'section_width': 'page-width',
                                 'padding-block-start': 8, 'padding-block-end': 64})

write('page.contact.json', {'intro': contact_intro, 'form': contact_form},
      ['intro', 'form'])

# ----------------------------------------------------------------- 404 ------
not_found = {
    'type': 'main-404',
    'settings': {'section_width': 'page-width',
                 'padding-block-start': 80, 'padding-block-end': 40},
    'blocks': {
        'title': text('<h1>Deze pagina bestaat niet</h1>', type_preset='h2', alignment='left'),
        'body': text(
            '<p>De link klopt niet meer of het product is uit de collectie gehaald. '
            'Hieronder staat wat er wel is.</p>',
            type_preset='rte', max_width='narrow', alignment='left'),
        'button': {'type': 'button', 'settings': {
            'label': 'Naar alle artikelen', 'link': 'shopify://collections/all',
            'style_class': 'button'}},
    },
    'block_order': ['title', 'body', 'button'],
}

not_found_products = preset('product-list', 't:names.products_grid')
not_found_products['settings'].update({'max_products': 4, 'columns': 4, 'mobile_columns': '2',
                                       'padding-block-start': 24, 'padding-block-end': 64})

write('404.json', {'main': not_found, 'products': not_found_products},
      ['main', 'products'])
