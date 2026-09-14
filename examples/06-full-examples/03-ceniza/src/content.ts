/**
 * What Ceniza says: the carta, the wines, the tasting menu, the people, the rooms, the journal and the dates.
 *
 * Kept apart from the pages so a change of season is an edit to data, not to layout.
 */

export const restaurant = {
  name: 'Ceniza',
  tagline: 'Cocina de fuego y temporada',
  city: 'Madrid',
  address: 'Calle del Carbón 12, 28014 Madrid',
  phone: '+34 910 123 456',
  phoneHref: 'tel:+34910123456',
  email: 'reservas@ceniza.example',
  season: 'Otoño 2026'
};

export const chef = { name: 'Martín Ferrer', role: 'Chef y fundador' };

/** Unsplash, sized per use so a thumbnail never downloads a hero. */
export const photo = (id: string, width: number): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;

export const photos = {
  heroTable: '1414235077428-338989a2e8c0',
  fireKitchen: '1600565193348-f74bd3c7ccdf',
  chefPlating: '1577219491135-ce391730fb2c',
  chefKnife: '1551218808-94e220e084d2',
  trout: '1467003909585-2f8a72700288',
  shortRib: '1544025162-d76694265947',
  raspberry: '1565958011703-44f9829ba187',
  greens: '1540189549336-e6e99c3679fe',
  cocktail: '1514362545857-3bc16c4c7d1b',
  pouring: '1470337458703-46ad1756a187',
  toast: '1510812431401-41d2bd2722f3',
  produce: '1498837167922-ddd27525d352',
  darkRoom: '1590846406792-0adc7f938f1d',
  terrace: '1600093463592-8e36ae95ef56',
  diningRoom: '1517248135467-4c7edcad34c4',
  sharedTable: '1528605248644-14dd04022da1',
  vineyard: '1506377247377-2a5b3b417ebb',
  winePour: '1553361371-9b22f78e8b1d',
  wineShelf: '1516594915697-87eb3b1c14ea',
  bread: '1509440159596-0249088772ff',
  market: '1488459716781-31db52582fe9',
  harvest: '1464226184884-fa280b87c399',
  slicedMeat: '1558030006-450675393462',
  gift: '1512909006721-3d6018887383',
  honey: '1558642452-9d2a7deb7f62',
  mushrooms: '1504545102780-26774c1bb073',
  cheeseFigs: '1452195100486-9cc805987862',
  pumpkin: '1506917728037-b6af01a7d403',
  field: '1560493676-04071c5f467b'
};

export type DietTag = 'V' | 'VG' | 'SG' | 'SA';

export const dietLabels: Record<DietTag, string> = {
  V: 'Vegetariano',
  VG: 'Vegano',
  SG: 'Sin gluten',
  SA: 'Sin alcohol'
};

export interface Dish {
  name: string;
  description: string;
  price: string;
  tags?: DietTag[];
}

export interface MenuSection {
  id: string;
  title: string;
  note: string;
  items: Dish[];
  /** Drinks carry no diet worth filtering by, so the carta's filters leave a section marked this way alone. */
  unfiltered?: true;
}

export const signatureDishes: (Dish & { photo: string })[] = [
  {
    name: 'Costilla glaseada',
    description: 'Vaca vieja, doce horas sobre brasa de encina y un glaseado de su propio jugo con miel de brezo.',
    price: '27 €',
    tags: ['SG'],
    photo: photos.shortRib
  },
  {
    name: 'Trucha al sarmiento',
    description: 'Trucha de río de León, beurre blanc de sidra y hojas amargas de nuestra huerta.',
    price: '24 €',
    tags: ['SG'],
    photo: photos.trout
  },
  {
    name: 'Milhojas de frambuesa',
    description: 'Hojaldre caramelizado, crema de vainilla tostada al rescoldo y frambuesas de Aranjuez.',
    price: '10 €',
    tags: ['V'],
    photo: photos.raspberry
  }
];

export const menu: MenuSection[] = [
  {
    id: 'para-empezar',
    title: 'Para empezar',
    note: 'Pequeños bocados para abrir la mesa mientras se enciende el fuego.',
    items: [
      {
        name: 'Pan de centeno y masa madre',
        description: 'Mantequilla de Campo Real ahumada con sarmiento.',
        price: '6 €',
        tags: ['V']
      },
      {
        name: 'Gilda de la casa',
        description: 'Boquerón curado por nosotros, guindilla encurtida y aceituna gordal.',
        price: '4,50 €',
        tags: ['SG']
      },
      {
        name: 'Remolacha en ceniza',
        description: 'Asada entre las brasas, yogur de oveja, avellana tostada y eneldo.',
        price: '14 €',
        tags: ['V', 'SG']
      },
      {
        name: 'Crudo de gamba roja',
        description: 'Tomate fermentado durante 48 horas y aceite de hoja de higuera.',
        price: '21 €',
        tags: ['SG']
      }
    ]
  },
  {
    id: 'de-la-huerta',
    title: 'De la huerta',
    note: 'Verdura de productores a menos de 150 km. Cambia con cada cosecha.',
    items: [
      {
        name: 'Puerro a la brasa',
        description: 'Romesco de pimiento choricero, almendra marcona y perifollo.',
        price: '15 €',
        tags: ['VG', 'SG']
      },
      {
        name: 'Coliflor entera glaseada',
        description: 'Miso de garbanzo hecho en casa, sésamo negro y lima.',
        price: '16 €',
        tags: ['VG', 'SG']
      },
      {
        name: 'Calabaza al rescoldo',
        description: 'Asada toda la noche entre la ceniza, requesón de oveja y pipas tostadas con miel.',
        price: '15 €',
        tags: ['V', 'SG']
      },
      {
        name: 'Setas de temporada',
        description: 'Yema curada en sal y azúcar, caldo de pan tostado y tomillo limonero.',
        price: '19 €',
        tags: ['V']
      }
    ]
  },
  {
    id: 'del-fuego',
    title: 'Del fuego',
    note: 'Encina para la carne, sarmiento para el pescado. Sin gas en la cocina caliente.',
    items: [
      {
        name: 'Pulpo a la brasa',
        description: 'Patata ahumada, pimentón de la Vera y aceite de su cocción.',
        price: '26 €',
        tags: ['SG']
      },
      {
        name: 'Trucha al sarmiento',
        description: 'Trucha de río de León, beurre blanc de sidra y hojas amargas.',
        price: '24 €',
        tags: ['SG']
      },
      {
        name: 'Costilla glaseada',
        description: 'Vaca vieja, doce horas de brasa y glaseado de miel de brezo.',
        price: '27 €',
        tags: ['SG']
      },
      {
        name: 'Chuletón de vaca madurada',
        description: 'Un kilo para compartir, 45 días de maduración y sal en escamas.',
        price: '78 €',
        tags: ['SG']
      }
    ]
  },
  {
    id: 'postres',
    title: 'Postres',
    note: 'El horno se queda con el calor que sobra al final del servicio.',
    items: [
      {
        name: 'Tarta de queso a la brasa',
        description: 'Queso de oveja, corteza tostada y helado de miel de brezo.',
        price: '9 €',
        tags: ['V']
      },
      {
        name: 'Milhojas de frambuesa',
        description: 'Crema de vainilla tostada al rescoldo y frambuesas de Aranjuez.',
        price: '10 €',
        tags: ['V']
      },
      {
        name: 'Higos asados',
        description: 'Crema de leche de oveja, tomillo y aceite de oliva arbequina.',
        price: '9 €',
        tags: ['V', 'SG']
      }
    ]
  },
  {
    id: 'para-beber',
    title: 'Para beber',
    note: 'Una barra que también cocina con humo. La bodega completa está en la carta de vinos.',
    unfiltered: true,
    items: [
      {
        name: 'Negroni de la casa',
        description: 'Vermut rojo macerado con piel de naranja asada.',
        price: '12 €'
      },
      {
        name: 'Humo y cítrico',
        description: 'Mezcal, naranja sanguina, romero quemado y sal ahumada.',
        price: '13 €'
      },
      {
        name: 'Kombucha de manzana',
        description: 'Fermentada en casa con jengibre y hierbabuena.',
        price: '6 €',
        tags: ['SA']
      },
      {
        name: 'Copa de vino natural',
        description: 'Doce vinos por copa que cambian cada semana.',
        price: 'desde 7 €'
      }
    ]
  }
];

export interface TastingStep {
  name: string;
  description: string;
}

export const tastingMenu = {
  name: 'Menú Brasa',
  steps: 9,
  duration: '2 h 30 min',
  price: '95 €',
  pairing: '55 €',
  pairingFree: '35 €',
  vegetal: { name: 'Menú Huerta', price: '85 €' },
  courses: [
    { name: 'Aperitivos del fuego', description: 'Gilda curada, tartaleta de remolacha en ceniza y crujiente de pan.' },
    { name: 'Pan y mantequilla', description: 'Centeno de masa madre y mantequilla ahumada con sarmiento.' },
    { name: 'Crudo', description: 'Gamba roja, tomate fermentado y aceite de hoja de higuera.' },
    { name: 'Huerta', description: 'Puerro a la brasa con romesco de pimiento choricero.' },
    { name: 'Bosque', description: 'Setas de temporada, yema curada y caldo de pan tostado.' },
    { name: 'Río', description: 'Trucha al sarmiento con beurre blanc de sidra.' },
    { name: 'Fuego', description: 'Costilla de vaca vieja glaseada durante doce horas.' },
    { name: 'Frescor', description: 'Granizado de manzana verde, hierbabuena y kéfir.' },
    { name: 'Dulce', description: 'Milhojas de frambuesa y vainilla tostada al rescoldo.' }
  ] satisfies TastingStep[]
};

export interface Pillar {
  icon: string;
  title: string;
  text: string;
}

export const pillars: Pillar[] = [
  {
    icon: 'fas fa-fire',
    title: 'Fuego',
    text: 'Encina para la carne, sarmiento para el pescado y rescoldo para los postres. La cocina caliente no tiene gas.'
  },
  {
    icon: 'fas fa-leaf',
    title: 'Temporada',
    text: 'La carta cambia cuatro veces al año. Si un producto no está en su mejor momento, no está en el plato.'
  },
  {
    icon: 'fas fa-location-dot',
    title: 'Territorio',
    text: 'Trabajamos con seis productores a menos de 150 km y conocemos por su nombre a quien cultiva cada verdura.'
  }
];

export const producers = [
  { name: 'Huerta El Rincón', product: 'Verdura y fruta', place: 'Aranjuez', distance: '47 km' },
  { name: 'Quesería de Campo Real', product: 'Quesos y mantequilla', place: 'Campo Real', distance: '38 km' },
  { name: 'Molino de Tielmes', product: 'Harinas de centeno y trigo', place: 'Tielmes', distance: '45 km' },
  { name: 'Ganadería Sierra Norte', product: 'Vaca vieja y cordero', place: 'Guadarrama', distance: '62 km' },
  { name: 'Bodega Alto Alberche', product: 'Vinos naturales', place: 'Cebreros', distance: '98 km' },
  { name: 'Colmenar de la Alcarria', product: 'Miel de brezo', place: 'Brihuega', distance: '112 km' }
];

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
}

export const team: TeamMember[] = [
  {
    name: chef.name,
    role: chef.role,
    bio: 'Quince años entre las brasas del País Vasco y Buenos Aires antes de encender la de Ceniza en 2019.'
  },
  {
    name: 'Tomás Rey',
    role: 'Jefe de cocina',
    bio: 'El guardián del fuego: enciende la encina a las nueve de la mañana y es el último en apagarla.'
  },
  {
    name: 'Irene Sanz',
    role: 'Sumiller',
    bio: 'Recorre cada mes las viñas de Gredos y escribe a mano la carta de copas de la semana.'
  },
  {
    name: 'Nuria Beltrán',
    role: 'Pastelera',
    bio: 'Alimenta la masa madre dos veces al día y termina los postres en el rescoldo del servicio.'
  }
];

export interface Milestone {
  year: string;
  title: string;
  text: string;
}

export const milestones: Milestone[] = [
  {
    year: '2019',
    title: 'Abrimos en la Calle del Carbón',
    text: 'Seis mesas, una parrilla y un antiguo almacén de carbón que conservaba las paredes ennegrecidas.'
  },
  {
    year: '2021',
    title: 'Una huerta propia',
    text: 'Empezamos a cultivar una hectárea junto a Huerta El Rincón, en Aranjuez, pensada para nuestra carta.'
  },
  {
    year: '2023',
    title: 'La mesa larga',
    text: 'Abrimos la sala privada frente a la cocina y estrenamos el menú Brasa de nueve pasos.'
  },
  {
    year: '2025',
    title: 'Cocina de residuo cero',
    text: 'Fermentos, caldos y compost: casi todo lo que entra en la cocina acaba en un plato o vuelve a la tierra.'
  },
  {
    year: '2026',
    title: 'Siete años de fuego',
    text: 'Treinta y ocho personas en el equipo y la misma brasa de encina que encendimos el primer día.'
  }
];

export const testimonials = [
  {
    quote: 'La mejor cocina de brasa que he probado en Madrid. Cada plato sabe a leña y a paciencia.',
    name: 'Elena Márquez',
    role: 'Cena de aniversario'
  },
  {
    quote: 'Un menú degustación que se recuerda durante semanas, y una sala que te hace sentir en casa.',
    name: 'Revista Mesa & Fuego',
    role: 'Reseña, otoño 2026'
  },
  {
    quote: 'Vinimos por la costilla y volvimos por todo lo demás. El equipo de sala es de otro nivel.',
    name: 'Javier Robles',
    role: 'Cliente habitual'
  }
];

export interface SeasonalProduct {
  name: string;
  months: string;
  note: string;
  photo: string;
  alt: string;
}

export const seasonal: SeasonalProduct[] = [
  {
    name: 'Setas de otoño',
    months: 'Oct – Dic',
    note: 'Níscalos y boletus de la Sierra de Guadarrama, a la brasa con yema curada.',
    photo: photos.mushrooms,
    alt: 'Setas frescas sobre una mesa de piedra'
  },
  {
    name: 'Calabaza',
    months: 'Oct – Ene',
    note: 'Asada entera en el rescoldo durante toda la noche y terminada con requesón de oveja.',
    photo: photos.pumpkin,
    alt: 'Calabaza naranja en el campo'
  },
  {
    name: 'Higos y queso de oveja',
    months: 'Sep – Oct',
    note: 'Los últimos higos del año con el queso curado de Campo Real.',
    photo: photos.cheeseFigs,
    alt: 'Tabla de quesos con higos y nueces'
  },
  {
    name: 'Miel de brezo',
    months: 'Todo el otoño',
    note: 'De Brihuega: glasea la costilla y endulza la tarta de queso a la brasa.',
    photo: photos.honey,
    alt: 'Miel cayendo de un cazo de madera en un tarro'
  }
];

export const rooms = [
  {
    name: 'La mesa larga',
    capacity: 'Hasta 14 personas',
    description: 'Una sola mesa de roble frente a la cocina abierta. Menú degustación y maridaje en exclusiva.',
    photo: photos.darkRoom
  },
  {
    name: 'Terraza de la higuera',
    capacity: 'Hasta 40 personas',
    description: 'El patio interior, bajo la higuera y con brasero propio. De mayo a octubre y en noches templadas.',
    photo: photos.terrace
  },
  {
    name: 'Ceniza al completo',
    capacity: 'Hasta 90 personas',
    description: 'Todo el restaurante para bodas íntimas, presentaciones o cenas de empresa con menú a medida.',
    photo: photos.diningRoom
  }
];

export const events = [
  {
    day: '02',
    month: 'Oct 2026',
    title: 'Cena a cuatro manos',
    description: `${chef.name} comparte fuego con un cocinero invitado de la costa gallega. Siete pasos y maridaje.`,
    price: '120 €'
  },
  {
    day: '17',
    month: 'Oct 2026',
    title: 'Noche de vinos naturales',
    description: 'Cinco bodegas de Gredos, cinco pases pequeños y los viticultores sentados a la mesa.',
    price: '65 €'
  },
  {
    day: '07',
    month: 'Nov 2026',
    title: 'Taller de fermentación',
    description: 'Una mañana en nuestra despensa: kombucha, miso y encurtidos para llevarse a casa.',
    price: '45 €'
  },
  {
    day: '11',
    month: 'Dic 2026',
    title: 'Cena de solsticio',
    description: 'La noche más larga del año, alrededor de la brasa, con un menú que solo se cocina una vez.',
    price: '110 €'
  }
];

export interface ProcessStep {
  title: string;
  text: string;
}

export const eventSteps: ProcessStep[] = [
  {
    title: 'Cuéntanos la idea',
    text: 'Fecha, número de invitados y qué celebráis. Te respondemos en menos de 24 horas con una propuesta.'
  },
  {
    title: 'Diseñamos el menú',
    text: 'Lo probamos contigo: la prueba para dos personas está incluida en eventos de más de 30 invitados.'
  },
  {
    title: 'Nos encargamos del resto',
    text: 'Sala, flores, música y maridaje. Vosotros solo tenéis que llegar con hambre.'
  }
];

export interface Wine {
  name: string;
  producer: string;
  region: string;
  grape: string;
  glass?: string;
  bottle?: string;
}

export interface WineSection {
  id: string;
  title: string;
  note: string;
  items: Wine[];
}

export const wineSections: WineSection[] = [
  {
    id: 'espumosos',
    title: 'Burbujas',
    note: 'Ancestrales y espumosos de larga crianza para abrir la mesa.',
    items: [
      {
        name: 'Ancestral de Garnacha',
        producer: 'Bodega Alto Alberche',
        region: 'Cebreros, Gredos',
        grape: 'Garnacha rosada',
        glass: '8 €',
        bottle: '38 €'
      },
      {
        name: 'Brut Nature Fonts Velles',
        producer: 'Celler Fonts Velles',
        region: 'Penedès',
        grape: 'Xarel·lo y Macabeo',
        glass: '9 €',
        bottle: '44 €'
      }
    ]
  },
  {
    id: 'blancos',
    title: 'Blancos y naranjas',
    note: 'Blancos de altura y vinos con piel para los platos de huerta y el pescado.',
    items: [
      {
        name: 'Albillo Real',
        producer: 'Viñas del Alberche',
        region: 'San Martín de Valdeiglesias',
        grape: 'Albillo',
        glass: '8 €',
        bottle: '36 €'
      },
      {
        name: 'Piel de Malvar',
        producer: 'Bodega Tajuña',
        region: 'Vinos de Madrid',
        grape: 'Malvar, diez días con sus pieles',
        glass: '9 €',
        bottle: '40 €'
      },
      {
        name: 'Salitre',
        producer: 'Adega Mar de Ons',
        region: 'Rías Baixas',
        grape: 'Albariño',
        glass: '10 €',
        bottle: '46 €'
      }
    ]
  },
  {
    id: 'tintos',
    title: 'Tintos',
    note: 'Garnachas de granito y pizarra, mencías de ladera y algún clásico para la brasa.',
    items: [
      {
        name: 'Granito',
        producer: 'Bodega Alto Alberche',
        region: 'Cebreros, Gredos',
        grape: 'Garnacha',
        glass: '9 €',
        bottle: '42 €'
      },
      {
        name: 'Mencía de ladera',
        producer: 'Viña Os Castros',
        region: 'Bierzo',
        grape: 'Mencía',
        glass: '9 €',
        bottle: '40 €'
      },
      {
        name: 'Páramo Alto',
        producer: 'Bodega Páramo Alto',
        region: 'Ribera del Duero',
        grape: 'Tinto Fino',
        glass: '12 €',
        bottle: '58 €'
      },
      {
        name: 'Llicorella 2019',
        producer: 'Clos de la Llicorella',
        region: 'Priorat',
        grape: 'Garnacha y Cariñena',
        bottle: '96 €'
      }
    ]
  },
  {
    id: 'generosos',
    title: 'Generosos y dulces',
    note: 'Para el aperitivo, el queso o el último rescoldo del postre.',
    items: [
      {
        name: 'Fino en rama',
        producer: 'Bodega La Aguja',
        region: 'Jerez',
        grape: 'Palomino',
        glass: '6 €',
        bottle: '32 €'
      },
      {
        name: 'PX de soleras viejas',
        producer: 'Bodega La Aguja',
        region: 'Jerez',
        grape: 'Pedro Ximénez',
        glass: '9 €'
      }
    ]
  },
  {
    id: 'sin-alcohol',
    title: 'Sin alcohol',
    note: 'Fermentados y zumos de la casa, pensados para acompañar igual que un vino.',
    items: [
      {
        name: 'Mosto de Albillo',
        producer: 'Viñas del Alberche',
        region: 'San Martín de Valdeiglesias',
        grape: 'Uva sin fermentar',
        glass: '5 €'
      },
      {
        name: 'Kéfir de agua e higuera',
        producer: 'Despensa de Ceniza',
        region: 'Madrid',
        grape: 'Fermentado con hoja de higuera',
        glass: '5 €'
      },
      {
        name: 'Té frío ahumado',
        producer: 'Despensa de Ceniza',
        region: 'Madrid',
        grape: 'Lapsang souchong y manzana asada',
        glass: '5 €'
      }
    ]
  }
];

export const wineValues: Pillar[] = [
  {
    icon: 'fas fa-seedling',
    title: 'Viñedo vivo',
    text: 'Sin herbicidas ni pesticidas de síntesis, con levaduras del propio viñedo y el mínimo sulfuroso.'
  },
  {
    icon: 'fas fa-users',
    title: 'Personas, no marcas',
    text: 'Conocemos a quien poda cada viña. Nueve de cada diez botellas vienen de bodegas con menos de 20 hectáreas.'
  },
  {
    icon: 'fas fa-rotate',
    title: 'Siempre en movimiento',
    text: 'Doce vinos por copa que cambian cada semana, para que la bodega acompañe a la carta de temporada.'
  }
];

export const sommelier = {
  name: 'Irene Sanz',
  role: 'Sumiller',
  quote: '“Un buen vino natural no se explica: se sirve a la temperatura justa y se deja hablar al lado del plato.”'
};

export interface GiftCard {
  kicker: string;
  name: string;
  price: string;
  note: string;
  features: string[];
  featured?: true;
}

export const giftCards: GiftCard[] = [
  {
    kicker: 'Importe libre',
    name: 'Tarjeta Ceniza',
    price: 'desde 50 €',
    note: 'Quien la recibe elige qué y cuándo: carta, menú, vino o una cena de la agenda.',
    features: ['Importe a tu elección', 'El saldo se guarda entre visitas', 'Válida 12 meses']
  },
  {
    kicker: 'La más regalada',
    name: 'Menú Brasa para dos',
    price: '190 €',
    note: 'Los nueve pasos del menú degustación para dos personas, en sala o en la mesa larga.',
    features: ['Nueve pasos para dos', 'Aperitivo de bienvenida', 'Válida 12 meses'],
    featured: true
  },
  {
    kicker: 'Con maridaje',
    name: 'Brasa y bodega para dos',
    price: '300 €',
    note: 'El menú Brasa con el maridaje de seis copas elegido por nuestra sumiller.',
    features: ['Menú y maridaje para dos', 'Visita a la bodega', 'Válida 12 meses']
  }
];

export const giftSteps: ProcessStep[] = [
  {
    title: 'Elige la tarjeta',
    text: 'Un importe libre o una experiencia, con un mensaje escrito por ti para quien la recibe.'
  },
  {
    title: 'Recíbela al momento',
    text: 'Te la enviamos en PDF en unos minutos, o impresa en papel de algodón para recogerla en el restaurante.'
  },
  {
    title: 'Reserva con el código',
    text: 'Quien la recibe reserva online o por teléfono indicando el código. Tiene doce meses para disfrutarla.'
  }
];

export interface Faq {
  question: string;
  answer: string;
}

export const faqs: Record<'reservas' | 'regalar' | 'eventos', Faq[]> = {
  reservas: [
    {
      question: '¿Puedo reservar para más de 8 personas?',
      answer:
        'Sí. Escríbenos y te proponemos la mesa larga o un menú cerrado para grupos, con la bebida incluida si lo prefieres.'
    },
    {
      question: '¿Adaptáis los platos a alergias e intolerancias?',
      answer: 'Adaptamos casi toda la carta. Para el menú degustación, avísanos con 48 horas y ajustamos cada paso.'
    },
    {
      question: '¿Hay código de vestimenta?',
      answer: 'Ninguno. Ven como estés cómodo: aquí se viene a comer bien, no a desfilar.'
    },
    {
      question: '¿Se puede venir con niños?',
      answer: 'Por supuesto. Tenemos tronas y medias raciones de varios platos de la carta.'
    },
    {
      question: '¿Cómo cambio o cancelo mi reserva?',
      answer: 'Llámanos o responde al email de confirmación. Cambiar o cancelar es gratis hasta 24 horas antes.'
    }
  ],
  regalar: [
    {
      question: '¿Cuánto tiempo es válida la tarjeta?',
      answer: 'Doce meses desde la compra. Si no llegas a tiempo, escríbenos: casi siempre encontramos una solución.'
    },
    {
      question: '¿Se puede usar en varias visitas?',
      answer:
        'La tarjeta de importe libre, sí: el saldo que sobra se queda guardado. Las experiencias se disfrutan en una sola visita.'
    },
    {
      question: '¿Puedo cambiar la experiencia por otra?',
      answer: 'Sí, pagando o descontando la diferencia. El maridaje también puede cambiarse por la versión sin alcohol.'
    },
    {
      question: '¿Sirve para eventos y cenas especiales?',
      answer: 'Sí, para todo lo que se sirve en Ceniza, incluidas las cenas de la agenda.'
    }
  ],
  eventos: [
    {
      question: '¿Con cuánta antelación hay que reservar?',
      answer:
        'Para la mesa larga suelen bastar dos o tres semanas. Para el restaurante completo recomendamos dos meses, sobre todo en diciembre.'
    },
    {
      question: '¿Podemos traer nuestra propia tarta o vino?',
      answer:
        'La tarta, sí, sin coste. Para el vino aplicamos un descorche de 20 € por botella, y te ayudamos a elegir si prefieres nuestra bodega.'
    },
    {
      question: '¿Hay opciones para invitados con alergias?',
      answer:
        'Siempre. Pásanos la lista de invitados con sus restricciones y adaptamos cada plato sin que se note en la mesa.'
    }
  ]
};

export interface Article {
  slug: string;
  title: string;
  category: string;
  date: string;
  readTime: string;
  photo: string;
  alt: string;
  excerpt: string;
  lead: string;
  body: { heading: string; paragraphs: string[] }[];
  quote: { text: string; author: string };
  figure: { photo: string; alt: string; caption: string };
}

export const articles: Article[] = [
  {
    slug: 'por-que-encina',
    title: 'Por qué solo cocinamos con encina',
    category: 'Cocina',
    date: '12 sep 2026',
    readTime: '4 min',
    photo: photos.slicedMeat,
    alt: 'Carne a la brasa cortada en lonchas sobre una tabla',
    excerpt:
      'Arde despacio, da un calor seco y deja una brasa que aguanta horas. Por eso no hay gas en nuestra cocina caliente.',
    lead: 'Cada mañana, a las nueve, Tomás enciende la brasa con la misma leña de encina. A mediodía ya no hay llamas, solo un rescoldo naranja que aguantará hasta el último pase de la cena. Ese calor lento es el ingrediente que más usamos y el que menos se ve.',
    body: [
      {
        heading: 'Un calor que no tiene prisa',
        paragraphs: [
          'La encina es una madera densa. Tarda en prender, pero cuando lo hace arde de forma pareja y casi sin humo. Eso nos permite dejar una costilla doce horas sobre la parrilla sin que el exterior se queme antes de que el interior esté listo.',
          'Con maderas más blandas el fuego sube y baja. Con gas, el calor es exacto pero plano: cocina, pero no aporta nada. La brasa de encina tuesta, ahúma ligeramente y concentra el sabor del producto.'
        ]
      },
      {
        heading: 'Una madera para cada plato',
        paragraphs: [
          'La encina es la base, pero no la única. Para el pescado usamos sarmiento de las viñas de Cebreros, que da una llama rápida y aromática. Para los postres aprovechamos el rescoldo del final del servicio, cuando el calor ya es suave.',
          'Cambiar de madera es como cambiar de especia: el mismo producto sabe distinto. Por eso la trucha y la costilla nunca comparten fuego.'
        ]
      },
      {
        heading: 'De dónde viene la leña',
        paragraphs: [
          'Compramos la leña a una cooperativa forestal de la Sierra Oeste de Madrid que trabaja con podas y aclareos autorizados. No se tala un árbol para cocinar: se aprovecha lo que el monte necesita quitarse para estar sano.',
          'La ceniza que sobra tampoco se tira. Vuelve a la huerta de Aranjuez como abono, y así el fuego cierra el círculo donde empezó el producto.'
        ]
      }
    ],
    quote: { text: '“Una brasa bien hecha no tiene prisa. Nosotros tampoco.”', author: 'Tomás Rey, jefe de cocina' },
    figure: {
      photo: photos.shortRib,
      alt: 'Costilla glaseada recién salida de la brasa',
      caption: 'La costilla, después de doce horas sobre la encina.'
    }
  },
  {
    slug: 'una-manana-en-la-huerta',
    title: 'Una mañana en Huerta El Rincón',
    category: 'Productores',
    date: '28 ago 2026',
    readTime: '5 min',
    photo: photos.field,
    alt: 'Campo de cultivo en hileras al amanecer',
    excerpt:
      'A las siete, en Aranjuez, se decide buena parte de la carta de otoño. Pasamos una mañana con quien cultiva nuestras verduras.',
    lead: 'Son las siete de la mañana en Aranjuez y Rosa Martín ya lleva una hora recogiendo. Antes de que apriete el calor hay que cortar las acelgas, revisar los puerros y decidir qué tomates aguantan un día más en la mata. Lo que salga hoy de esta huerta estará en nuestra cocina esta tarde.',
    body: [
      {
        heading: 'Cuarenta y siete kilómetros',
        paragraphs: [
          'Huerta El Rincón es una finca familiar de tres hectáreas junto al Tajo. Rosa y su hermano Andrés la heredaron de sus padres y la pasaron a cultivo ecológico en 2015. Desde 2021 compartimos con ellos una hectárea en la que plantamos lo que la carta necesita.',
          'La cercanía no es solo una cifra. Un puerro que se recoge por la mañana y se asa por la noche conserva un dulzor que se pierde en dos días de cámara.'
        ]
      },
      {
        heading: 'La carta se escribe aquí',
        paragraphs: [
          'No llegamos con una lista de pedidos. Paseamos la finca, probamos lo que está en su punto y preguntamos qué viene en las próximas semanas. Si las setas se retrasan o la calabaza llega antes, la carta cambia.',
          'Así nació la remolacha en ceniza: un año salieron muchas más remolachas de las que nadie esperaba, y había que encontrarles un sitio.'
        ]
      },
      {
        heading: 'Lo que no llega al plato',
        paragraphs: [
          'Las piezas feas, las hojas y los tallos también viajan a Madrid. Con ellos hacemos caldos, encurtidos y el miso de la casa. Lo poco que sobra vuelve a la finca como compost, junto con la ceniza de nuestra brasa.'
        ]
      }
    ],
    quote: {
      text: '“Nosotros cultivamos y ellos escuchan. Por eso la verdura sabe a algo.”',
      author: 'Rosa Martín, Huerta El Rincón'
    },
    figure: {
      photo: photos.produce,
      alt: 'Verduras de temporada recién recogidas sobre una mesa',
      caption: 'Lo que llegó a la cocina esa misma tarde.'
    }
  },
  {
    slug: 'fermentar-para-no-tirar-nada',
    title: 'Masa madre, miso y kombucha: fermentar para no tirar nada',
    category: 'Despensa',
    date: '9 ago 2026',
    readTime: '6 min',
    photo: photos.bread,
    alt: 'Hogazas de pan de masa madre con espigas de trigo',
    excerpt:
      'Nuestra despensa trabaja mientras dormimos. Así convertimos recortes y excedentes en algunos de los sabores más queridos de la carta.',
    lead: 'Detrás de la cocina hay una habitación fresca llena de tarros. Ahí fermentan el miso de garbanzo, las kombuchas, los encurtidos y la masa madre del pan de centeno. Es la parte menos vistosa de Ceniza y, probablemente, la que más sabor aporta.',
    body: [
      {
        heading: 'Una masa madre de siete años',
        paragraphs: [
          'La masa madre nació la semana en que abrimos, con harina de centeno del Molino de Tielmes. Nuria la alimenta cada mañana y cada tarde. De ella sale el pan que llega a la mesa y la base de varios postres.'
        ]
      },
      {
        heading: 'El miso de los garbanzos rotos',
        paragraphs: [
          'Los garbanzos partidos no sirven para un guiso bonito, pero son perfectos para fermentar. Los cocemos, los mezclamos con koji y sal y los dejamos reposar entre seis meses y un año.',
          'El resultado glasea la coliflor entera y da profundidad a los caldos sin necesidad de carne.'
        ]
      },
      {
        heading: 'Kombucha, encurtidos y paciencia',
        paragraphs: [
          'La piel de manzana de los postres se convierte en kombucha. Los tallos de las acelgas y los recortes de zanahoria acaban en el vinagre de la casa. Nada de esto estaba planeado: fue la respuesta a una pregunta sencilla, qué hacer con lo que sobra.',
          'Hoy casi el 90 % de lo que entra en la cocina acaba en un plato, en un tarro o en el compost de la huerta.'
        ]
      }
    ],
    quote: { text: '“Fermentar es cocinar con tiempo en lugar de con fuego.”', author: 'Nuria Beltrán, pastelera' },
    figure: {
      photo: photos.harvest,
      alt: 'Zanahorias, pepinos y guindillas preparados para encurtir',
      caption: 'Zanahorias, pepinos y guindillas, listos para el encurtido.'
    }
  }
];

/**
 * Opening hours, by the short English weekday `Intl` answers with — the plugin compares against that, in the
 * restaurant's own time zone rather than the visitor's.
 */
export const openingHours = {
  timeZone: 'Europe/Madrid',
  schedule: [
    { day: 'Mon', label: 'Lunes', hours: [] },
    { day: 'Tue', label: 'Martes', hours: ['13:30-16:00', '20:00-23:30'] },
    { day: 'Wed', label: 'Miércoles', hours: ['13:30-16:00', '20:00-23:30'] },
    { day: 'Thu', label: 'Jueves', hours: ['13:30-16:00', '20:00-23:30'] },
    { day: 'Fri', label: 'Viernes', hours: ['13:30-16:00', '20:00-00:00'] },
    { day: 'Sat', label: 'Sábado', hours: ['13:30-16:30', '20:00-00:00'] },
    { day: 'Sun', label: 'Domingo', hours: ['13:30-16:30'] }
  ]
};

export const bookingTimes = ['13:30', '14:00', '14:30', '15:00', '20:00', '20:30', '21:00', '21:30', '22:00'];
