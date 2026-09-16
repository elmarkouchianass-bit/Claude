# Tests

Geen Shopify-store nodig. `shopify theme push` uploadt alleen de bekende themamappen, dus deze map
gaat niet mee naar de winkel.

```sh
ruby tests/ladder_liquid_test.rb     # staffel-rekenwerk in Liquid (sortering, treden, resterend aantal)
ruby tests/blocks_render_test.rb     # rendert elk vor-blok en controleert de uitvoer
node tests/volume_discount_test.mjs  # kortingscode-logica van de runtime
```

De Ruby-tests draaien op de `liquid` gem (`gem install liquid`). Die gem kent de
Shopify-specifieke tags en filters niet, dus die worden in de harness gestubd: `t` geeft
`«sleutel arg=waarde»` terug zodat je kunt zien *welke* vertaalsleutel met welke variabelen wordt
aangeroepen. `{% render %}` wordt vervangen door `{% include %}`, omdat de gem bij `render` de
globale objecten (`settings`, `cart`) niet doorgeeft en Shopify dat wel doet.
