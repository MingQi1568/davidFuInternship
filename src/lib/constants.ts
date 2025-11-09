export const FIRMS = [
  { name: "Jane Street", slug: "jane-street", logo: "/logos/jane-street.jpeg" },
  { name: "Citadel", slug: "citadel", logo: "/logos/citadel.jpeg" },
  { name: "Bridgewater", slug: "bridgewater", logo: "/logos/bridgewater.png" },
  { name: "D E Shaw", slug: "de-shaw", logo: "/logos/de-shaw.png" },
  { name: "Radix", slug: "radix", logo: "/logos/radix.jpeg" },
  { name: "ArrowStreet", slug: "arrowstreet", logo: "/logos/arrowstreet.png" },
  { name: "PDT Partners", slug: "pdt-partners", logo: "/logos/pdt-partners.jpeg" },
  { name: "Point72", slug: "point72", logo: "/logos/point72.jpeg" },
  { name: "Hudson River Trading", slug: "hrt", logo: "/logos/hrt.png" },
  { name: "Jump Trading", slug: "jump-trading", logo: "/logos/jump-trading.jpeg" },
  { name: "Optiver", slug: "optiver", logo: "/logos/optiver.jpeg" },
  { name: "Two Sigma", slug: "two-sigma", logo: "/logos/two-sigma.png" },
  { name: "Five Rings", slug: "five-rings", logo: "/logos/five-rings.jpeg" },
  { name: "Voleon", slug: "voleon", logo: "/logos/voleon.jpeg" },
] as const;

export const SECURITIES = FIRMS.map(({ name }) => name);

export type Security = (typeof SECURITIES)[number];

export const STARTING_CHIPS = 100;


