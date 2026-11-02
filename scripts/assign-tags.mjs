import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const assignments = [
  // Accesorios impresora 3D
  { file: "0.4_Nozzle_-_Every_Size_-_A1_Mini.3mf", tags: ["accesorios-impresora", "herramientas"] },
  { file: "A1_Mini_Dust_Cover_Set.3mf", tags: ["accesorios-impresora"] },
  { file: "a1_mini_HONEYCOMB.3mf", tags: ["accesorios-impresora"] },
  { file: "A1+Mini+Dust+Cover+Standee+noplate.3mf", tags: ["accesorios-impresora"] },
  { file: "A1-Mini_Modular_Bin_Collection.3mf", tags: ["accesorios-impresora", "organizador"] },
  { file: "Bambu_Lab_A1_Mini_Desk_Stabilizer.3mf", tags: ["accesorios-impresora"] },
  { file: "Buildplate_Cleaner_v10.3mf", tags: ["accesorios-impresora", "herramientas"] },
  { file: "CableOrganizer_Large_Gridfinity_A1_mini.3mf", tags: ["organizador", "cables", "accesorios-impresora"] },
  { file: "CableOrganizingBox_BS_A1mini.3mf", tags: ["organizador", "cables", "accesorios-impresora"] },
  { file: "5-layer_swatch_fixed.3mf", tags: ["calibración", "herramientas"] },

  // Navidad
  { file: "Anelli_Portatovaglioli_Natalizi.3mf", tags: ["navidad", "decoración"] },
  { file: "snowflakes.3mf", tags: ["navidad", "decoración"] },
  { file: "snowflakes(2).3mf", tags: ["navidad", "decoración"] },
  { file: "Esferas_personalizables.3mf", tags: ["navidad", "decoración"] },

  // Deportes / Pádel
  { file: "Bullpadel.3mf", tags: ["deportes", "pádel"] },
  { file: "Bullpadel_cabeza.3mf", tags: ["deportes", "pádel"] },
  { file: "Bullpadel_mango_y_perno.3mf", tags: ["deportes", "pádel"] },
  { file: "llavero_bullpadel.3mf", tags: ["llavero", "deportes", "pádel"] },
  { file: "llavero_de_mancuernas.3mf", tags: ["llavero", "deportes", "fitness"] },
  { file: "Mancuerna_3d.3mf", tags: ["deportes", "fitness"] },

  // Fútbol / River
  { file: "escudo+afa+medio+litro.3mf", tags: ["fútbol", "Argentina"] },
  { file: "LIBERTADORES_MADRID.3mf", tags: ["fútbol"] },
  { file: "R3D_-_Llavero_RIVER.3mf", tags: ["llavero", "fútbol", "River"] },
  { file: "River.3mf", tags: ["fútbol", "River"] },
  { file: "vaso_seleccion_-0.42_@3lementod.3mf", tags: ["fútbol", "Argentina"] },
  { file: "vaso_seleccion_500ML.3mf", tags: ["fútbol", "Argentina"] },
  { file: "CAIXA_FIGURINHA_DA_COPA_-_VERSAO_FIXA_-_REPARTIÇÃO_CENTRAL.3mf", tags: ["fútbol", "coleccionables"] },

  // Llaveros
  { file: "R3D_-_Llavero_LISO.3mf", tags: ["llavero"] },

  // Plantas
  { file: "Coins_Planter4In_50percent_A1_mini.3mf", tags: ["plantas", "decoración"] },
  { file: "Small_planter_0.24.3mf", tags: ["plantas"] },
  { file: "The_Claudia_Planter100_spiral.3mf", tags: ["plantas", "decoración"] },
  { file: "The_Claudia_Planter120_spiral.3mf", tags: ["plantas", "decoración"] },
  { file: "Vase_180mm.3mf", tags: ["plantas", "decoración"] },

  // Posavasos
  { file: "Drink_coaster_V2.3mf", tags: ["posavasos", "hogar"] },
  { file: "holder_+_4_basic_coasters.3mf", tags: ["posavasos", "hogar"] },
  { file: "minimalistic-coaster-x1.3mf", tags: ["posavasos", "hogar"] },
  { file: "posavasos_alisado.3mf", tags: ["posavasos", "hogar"] },

  // Organizadores / Cables
  { file: "Cable_Protector-New.3mf", tags: ["organizador", "cables"] },
  { file: "CableHolder_-_Loose_Fit_-_BambuStudio.3mf", tags: ["organizador", "cables"] },
  { file: "数据线收纳-Gridfinity_3mf.3mf", tags: ["organizador", "cables"] },
  { file: "Skadis-project.3mf", tags: ["organizador"] },
  { file: "Modern_Tray_200x120mm.3mf", tags: ["organizador", "hogar"] },
  { file: "ribbed_box_and_lid_mw.3mf", tags: ["organizador", "hogar"] },
  { file: "ribbed_box_and_lid_sm_mw.3mf", tags: ["organizador", "hogar"] },
  { file: "30W_Holder_V2.3mf", tags: ["organizador", "soporte"] },
  { file: "Heart_Lipstick_Balm_holder.3mf", tags: ["organizador"] },

  // Hogar / Cocina
  { file: "Ash_Bowl.3mf", tags: ["hogar", "decoración"] },
  { file: "Auto-locking_Hanger_(Tape).3mf", tags: ["organizador", "hogar"] },
  { file: "Bag_Clip_-_Set_of_8.3mf", tags: ["hogar", "cocina"] },
  { file: "Bola_hielo_personalizable.3mf", tags: ["cocina", "hogar"] },
  { file: "CurtainTieRing.3mf", tags: ["hogar", "decoración"] },
  { file: "DrainSnake_double.3mf", tags: ["hogar", "herramientas"] },
  { file: "Kitchen+Roll+Holder-Larger+Version.3mf", tags: ["hogar", "cocina"] },
  { file: "Modern_sponge_sink_holder.3mf", tags: ["hogar", "cocina"] },
  { file: "pojemnik_na_herbatę.3mf", tags: ["cocina", "hogar"] },
  { file: "SPREMI_DENTIFRICIO_FORMASTAMPA.3mf", tags: ["hogar", "baño"] },
  { file: "despolvillador_v2.3mf", tags: ["hogar", "herramientas"] },

  // Herramientas
  { file: "dowel_marker_8mm-16mm_v4.3mf", tags: ["herramientas"] },
  { file: "Outdoor_Kids-Knive_V1.0.3mf", tags: ["herramientas", "exterior"] },
  { file: "Skeleton_Knife.3mf", tags: ["herramientas", "decoración"] },

  // Coleccionables
  { file: "pokemon_card_protector_box_v41_2_part.3mf", tags: ["coleccionables", "pokemon"] },
  { file: "Protector_de_figuritas.3mf", tags: ["coleccionables"] },
  { file: "Protector_de_figuritas(2).3mf", tags: ["coleccionables"] },
  { file: "sigma-deck-box-v5-60-cards.3mf", tags: ["coleccionables", "juegos"] },
  { file: "Unveiling_F1_Redbull_RB20.3mf", tags: ["coleccionables", "F1"] },
  { file: "shadowbox.3mf", tags: ["decoración", "coleccionables"] },

  // Juguetes
  { file: "magic_card_wand_V2_complete.3mf", tags: ["juguetes"] },
  { file: "mini_twisty_dragon_egg_fidget_12.3mf", tags: ["juguetes", "fidget"] },

  // Decoración
  { file: "Perfect+clip+v4+final+update_4.3mf", tags: ["hogar"] },
];

let inserted = 0;
let skipped = 0;

for (const { file, tags } of assignments) {
  for (const tag of tags) {
    try {
      await p.$executeRaw`INSERT OR IGNORE INTO ModelTag (fileName, tag, createdAt) VALUES (${file}, ${tag}, datetime('now'))`;
      inserted++;
    } catch (e) {
      console.error(`Error inserting ${file} → ${tag}:`, e.message);
      skipped++;
    }
  }
}

const total = await p.$queryRaw`SELECT COUNT(*) as count FROM ModelTag`;
console.log(`Done. Inserted: ${inserted}, Skipped/errors: ${skipped}`);
console.log(`Total tags in DB: ${total[0].count}`);

await p.$disconnect();
