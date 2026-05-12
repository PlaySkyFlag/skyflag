// =============================================================================
// Thresan: Skyflag — Physical Edition (parametric CAD)
//
// Per:  docs/physical-edition-brief.md
// Spec: rulebook v20 (docs/rulebook-v20.pdf)
// Voice: "monastery, not tech" — matte, weighted, debossed not silkscreened
//
// HOW TO USE
//   1. Install OpenSCAD (free, openscad.org). v2021.01 or newer.
//   2. Open this file in OpenSCAD.
//   3. Change the PART variable below to the part you want to render.
//   4. Press F6 to render (full quality, takes 30s-2min depending on part).
//   5. File → Export → Export as STL.
//   6. Slice in your preferred slicer (Bambu Studio, Prusa Slicer, etc.) per
//      the print profile sketched in the brief.
//   7. Repeat for each part listed under "Available PART values" below.
//
// PRINTING SUMMARY (per brief)
//   - Body (boards / pillars / base): matte charcoal PLA
//   - P1 (Grey Ravens) pieces + flag tokens: slate gray PLA
//   - P2 (White Stags) pieces + flag tokens: ivory PLA
//   - Lift / Nexus / Sigil / Layer-name accents: gold paint post-print, OR
//     filament-swap to gold at the appropriate Z height
//   - All pieces have a recess in the base for an M10 steel washer (ballast)
//
// All dimensions in millimeters.
// =============================================================================


// -----------------------------------------------------------------------------
// PART SELECTOR — change this to render different parts
// -----------------------------------------------------------------------------
// Available values:
//   "ground_board" "sky_board" "space_board"
//   "pillar"  "base"
//   "captain"  "pilot"  "rover"  "soldier"     (set CLAN below)
//   "flag"                                      (set CLAN below)
//   "preview_assembly"                          (visual sanity check; do not export)

PART = "ground_board";

// For piece / flag exports: which clan?
//   "P1" = Grey Ravens (slate)
//   "P2" = White Stags (ivory)
CLAN = "P1";


// =============================================================================
// PARAMETERS
// =============================================================================

// Quality
$fn = 64;        // smoothness; bump to 128 for final renders, keep 32 for preview

// Aesthetic
BEVEL = 1.0;     // chamfer applied to most outer edges (1mm)

// --- Boards -------------------------------------------------------------------
BOARD_OD       = 240;
BOARD_THK      = 5;
GRID_N         = 6;
CELL_SIZE      = 28;
GRID_W         = GRID_N * CELL_SIZE;     // 168 mm play surface
GRID_LINE_W    = 0.5;
GRID_LINE_DEP  = 0.4;

// Lift markers (raised gold ring at each Lift cell, same 4 cells on every layer)
LIFT_OD        = 22;
LIFT_INNER_OD  = 18;
LIFT_RAISED    = 0.8;
LIFT_CELLS     = [[1,1], [1,4], [4,1], [4,4]];

// Nexus (Space board only) — 6-point star relief at Space(3,3)
NEXUS_OD       = 28;
NEXUS_RAISED   = 1.2;
NEXUS_POINTS   = 6;
NEXUS_CELL     = [3,3];

// Sigil engraved on each board's outer ring (opposite the layer name)
SIGIL_OD       = 14;
SIGIL_DEBOSS   = 0.6;

// Layer name engraved on each board's outer ring (top arc)
LABEL_FONT_SZ  = 7.5;
LABEL_DEBOSS   = 0.6;

// --- Pillars ------------------------------------------------------------------
PILLAR_OD          = 16;
PILLAR_LEN         = 170;
PILLAR_TENON_OD    = 8;
PILLAR_TENON_LEN   = 10;
// Pillar axis sits at this distance from board center, on the cardinal axes
PILLAR_AXIS_RADIUS = BOARD_OD/2 - 12;

// Sky board cutouts for pillars (clearance so Sky doesn't bind on pillar)
SKY_CUTOUT_OD      = 18;

// --- Base ---------------------------------------------------------------------
BASE_OD            = 220;
BASE_THK           = 18;
BASE_DOME_DEP      = 1.5;       // slight dome rise at center
BASE_SIGIL_OD      = 40;
BASE_SIGIL_DEBOSS  = 1.5;
BASE_SOCKET_OD     = 8;         // matches PILLAR_TENON_OD with light clearance
BASE_SOCKET_DEPTH  = 10;

// Motto engraved around the base perimeter
MOTTO_TEXT         = "THREE WORLDS  ·  ONE PROOF  ·  THREE WORLDS  ·  ONE PROOF  ·  ";
MOTTO_FONT_SZ      = 4.5;
MOTTO_DEBOSS       = 0.5;
MOTTO_TEXT_RADIUS  = BASE_OD/2 - 8;

// --- Pieces -------------------------------------------------------------------
PIECE_BASE_OD          = 22;
PIECE_BASE_H           = 6;
PIECE_WASHER_REC_OD    = 22;   // M10 washer is ~21mm OD; 1mm clearance for fit
PIECE_WASHER_REC_DEP   = 2.5;
CAPTAIN_H              = 60;
PILOT_H                = 50;
ROVER_H                = 45;
SOLDIER_H              = 40;

// Clan glyph debossed on the front face of each piece (raven / stag)
GLYPH_OD               = 6;
GLYPH_DEBOSS           = 0.6;
GLYPH_Z_FROM_BASE      = 20;   // height up the piece where the glyph sits

// --- Flag tokens --------------------------------------------------------------
FLAG_BASE_OD       = 18;
FLAG_BASE_H        = 3;
FLAG_POLE_OD       = 2.5;
FLAG_POLE_H        = 14;
FLAG_PENNANT_W     = 14;
FLAG_PENNANT_H     = 8;
FLAG_PENNANT_THK   = 1.5;


// =============================================================================
// HELPERS
// =============================================================================

// Grid (row, col) → (x, y) centered on board origin.
// Row 0 = top (positive y), Row 5 = bottom (negative y) per rulebook convention.
function cell_xy(row, col) = [
    (col - (GRID_N-1)/2) * CELL_SIZE,
    ((GRID_N-1)/2 - row) * CELL_SIZE
];


// --- Beveled cylinder (chamfered top, flat bottom) ----------------------------
module beveled_cylinder(d, h, bevel=BEVEL) {
    hull() {
        cylinder(d=d - 2*bevel, h=h);
        translate([0, 0, 0]) cylinder(d=d, h=h - bevel);
    }
}


// --- 3phor sigil (2D, intended for linear_extrude) ----------------------------
// Three concentric arcs (rings) pierced by a vertical line. Geometric, brand-
// consistent with the 3phor-logo.png raster asset.
module sigil_2d() {
    // outer ring
    difference() { circle(d=22); circle(d=20); }
    // middle ring
    difference() { circle(d=16); circle(d=14); }
    // inner ring
    difference() { circle(d=10); circle(d=8); }
    // vertical pierce line
    translate([-0.6, -14]) square([1.2, 28]);
    // center node
    circle(d=2);
}

module sigil(size=SIGIL_OD, depth=SIGIL_DEBOSS) {
    // sigil_2d() is sized to ~22mm; scale to requested size
    scale(size / 22)
        linear_extrude(depth)
            sigil_2d();
}


// --- Grid lines (relief on the play surface) ----------------------------------
module grid_relief(z_top) {
    for (i = [1:GRID_N-1]) {
        // horizontal lines
        translate([-GRID_W/2,
                   -GRID_W/2 + i*CELL_SIZE - GRID_LINE_W/2,
                   z_top - GRID_LINE_DEP])
            cube([GRID_W, GRID_LINE_W, GRID_LINE_DEP + 0.01]);
        // vertical lines
        translate([-GRID_W/2 + i*CELL_SIZE - GRID_LINE_W/2,
                   -GRID_W/2,
                   z_top - GRID_LINE_DEP])
            cube([GRID_LINE_W, GRID_W, GRID_LINE_DEP + 0.01]);
    }
    // grid border (just inside the outer cells)
    translate([0, 0, z_top - GRID_LINE_DEP])
        difference() {
            translate([-GRID_W/2 - GRID_LINE_W,
                       -GRID_W/2 - GRID_LINE_W, 0])
                cube([GRID_W + 2*GRID_LINE_W,
                      GRID_W + 2*GRID_LINE_W,
                      GRID_LINE_DEP + 0.01]);
            translate([-GRID_W/2, -GRID_W/2, -0.05])
                cube([GRID_W, GRID_W, GRID_LINE_DEP + 0.1]);
        }
}


// --- Lift marker (raised gold ring at given cell) -----------------------------
module lift_marker(z_top) {
    translate([0, 0, z_top])
        difference() {
            cylinder(d=LIFT_OD, h=LIFT_RAISED);
            translate([0, 0, -0.01])
                cylinder(d=LIFT_INNER_OD, h=LIFT_RAISED + 0.02);
        }
}


// --- Nexus marker (6-point star relief at Space(3,3)) ------------------------
module nexus_marker(z_top) {
    // Approximated as two overlapping triangles forming a 6-point star.
    translate([0, 0, z_top])
        union() {
            for (rot = [0, 60, 120]) {
                rotate([0, 0, rot])
                    linear_extrude(NEXUS_RAISED)
                        polygon(points = [
                            [0,                  NEXUS_OD/2],
                            [-NEXUS_OD/2 * 0.866, -NEXUS_OD/4],
                            [ NEXUS_OD/2 * 0.866, -NEXUS_OD/4]
                        ]);
            }
        }
}


// --- Layer label (text engraved on outer ring top arc) ------------------------
module layer_label(label, board_thk) {
    // Place along the top arc, debossed into the top surface.
    // The text is centered above the play grid, so y = +GRID_W/2 + 18
    translate([0, GRID_W/2 + 22, board_thk - LABEL_DEBOSS])
        linear_extrude(LABEL_DEBOSS + 0.01)
            text(label, size=LABEL_FONT_SZ, halign="center", valign="center",
                 font="Helvetica:style=Bold");
}


// --- Sigil on outer ring (bottom arc, opposite the label) ---------------------
module board_sigil(board_thk) {
    translate([0, -GRID_W/2 - 22, board_thk - SIGIL_DEBOSS])
        sigil();
}


// --- Pillar axis positions (cardinal points on the ring) ----------------------
// Returns the 4 (x,y) positions where pillars stand.
function pillar_positions() = [
    [ PILLAR_AXIS_RADIUS,  0],   // East
    [-PILLAR_AXIS_RADIUS,  0],   // West
    [ 0,  PILLAR_AXIS_RADIUS],   // North
    [ 0, -PILLAR_AXIS_RADIUS]    // South
];


// =============================================================================
// PART: GROUND BOARD (the Terran layer)
// =============================================================================

module ground_board() {
    union() {
        difference() {
            beveled_cylinder(d=BOARD_OD, h=BOARD_THK);
            grid_relief(BOARD_THK);
            layer_label("TERRAN", BOARD_THK);
            board_sigil(BOARD_THK);
        }
        // Lift markers (raised, separate union after the subtractions)
        for (cell = LIFT_CELLS) {
            translate(cell_xy(cell[0], cell[1]))
                lift_marker(BOARD_THK);
        }
    }
}


// =============================================================================
// PART: SKY BOARD (the Meridian layer) — has 4 pillar cutouts
// =============================================================================

module sky_board() {
    union() {
        difference() {
            beveled_cylinder(d=BOARD_OD, h=BOARD_THK);
            grid_relief(BOARD_THK);
            layer_label("MERIDIAN", BOARD_THK);
            board_sigil(BOARD_THK);
            // Pillar pass-through cutouts at cardinal points (no contact)
            for (pos = pillar_positions()) {
                translate([pos[0], pos[1], -0.5])
                    cylinder(d=SKY_CUTOUT_OD, h=BOARD_THK + 1);
            }
        }
        for (cell = LIFT_CELLS) {
            translate(cell_xy(cell[0], cell[1]))
                lift_marker(BOARD_THK);
        }
    }
}


// =============================================================================
// PART: SPACE BOARD (the Empyrean layer) — Nexus marker at (3,3)
// =============================================================================

module space_board() {
    union() {
        difference() {
            beveled_cylinder(d=BOARD_OD, h=BOARD_THK);
            grid_relief(BOARD_THK);
            layer_label("EMPYREAN", BOARD_THK);
            board_sigil(BOARD_THK);
        }
        for (cell = LIFT_CELLS) {
            translate(cell_xy(cell[0], cell[1]))
                lift_marker(BOARD_THK);
        }
        translate(cell_xy(NEXUS_CELL[0], NEXUS_CELL[1]))
            nexus_marker(BOARD_THK);
    }
}


// =============================================================================
// PART: PILLAR — long cylinder with tenons top and bottom
// =============================================================================

module pillar() {
    // Bottom tenon
    cylinder(d=PILLAR_TENON_OD, h=PILLAR_TENON_LEN);
    // Body
    translate([0, 0, PILLAR_TENON_LEN])
        cylinder(d=PILLAR_OD, h=PILLAR_LEN);
    // Top tenon
    translate([0, 0, PILLAR_TENON_LEN + PILLAR_LEN])
        cylinder(d=PILLAR_TENON_OD, h=PILLAR_TENON_LEN);
}


// =============================================================================
// PART: BASE — pillar sockets, sigil deboss, motto around perimeter
// =============================================================================

module base() {
    difference() {
        // Body with subtle dome
        union() {
            beveled_cylinder(d=BASE_OD, h=BASE_THK);
            translate([0, 0, BASE_THK - 0.01])
                cylinder(d1=BASE_OD * 0.7, d2=BASE_OD * 0.4, h=BASE_DOME_DEP);
        }
        // Pillar sockets
        for (pos = pillar_positions()) {
            translate([pos[0], pos[1], BASE_THK + BASE_DOME_DEP - BASE_SOCKET_DEPTH + 0.01])
                cylinder(d=BASE_SOCKET_OD, h=BASE_SOCKET_DEPTH + 0.5);
        }
        // Sigil deboss at center top
        translate([0, 0, BASE_THK + BASE_DOME_DEP - BASE_SIGIL_DEBOSS])
            scale(BASE_SIGIL_OD / 22)
                linear_extrude(BASE_SIGIL_DEBOSS + 0.01)
                    sigil_2d();
        // Motto around the perimeter
        motto_ring();
    }
}

// Motto text wrapped around the base perimeter, debossed.
module motto_ring() {
    chars = MOTTO_TEXT;
    n = len(chars);
    // Total angle covered = 360. Each char gets 360/n degrees.
    for (i = [0 : n - 1]) {
        angle = -i * (360 / n);
        rotate([0, 0, angle])
            translate([0, MOTTO_TEXT_RADIUS, BASE_THK + BASE_DOME_DEP - MOTTO_DEBOSS])
                rotate([0, 0, 180])
                    linear_extrude(MOTTO_DEBOSS + 0.01)
                        text(chars[i], size=MOTTO_FONT_SZ,
                             halign="center", valign="center",
                             font="Helvetica:style=Bold");
    }
}


// =============================================================================
// CLAN GLYPHS (raven / stag) — debossed on front face of each piece
// =============================================================================
// These are placeholder geometric stand-ins. For final aesthetics, replace
// these modules with linear_extrude(GLYPH_DEBOSS) import("raven.svg") /
// import("stag.svg") and place SVG files next to this .scad file.

module raven_glyph_2d() {
    // Stylized chevron suggesting wings; placeholder for proper raven SVG
    polygon(points = [
        [-3, 1.5], [0, -1.5], [3, 1.5],
        [2.2, 1.5], [0, -0.2], [-2.2, 1.5]
    ]);
}

module stag_glyph_2d() {
    // Stylized antler crown; placeholder for proper stag SVG
    polygon(points = [
        [-3, -1.5], [-2, 1], [-1, 0], [0, 1.5], [1, 0], [2, 1], [3, -1.5],
        [2.5, -1.5], [1.6, 0.4], [0.6, -0.6], [0, 0.2],
        [-0.6, -0.6], [-1.6, 0.4], [-2.5, -1.5]
    ]);
}

module clan_glyph(clan, depth=GLYPH_DEBOSS) {
    scale(GLYPH_OD / 6)
        linear_extrude(depth)
            if (clan == "P1") raven_glyph_2d();
            else              stag_glyph_2d();
}


// =============================================================================
// PIECES — Captain, Pilot, Rover, Soldier
// =============================================================================
// Each piece has:
//   - A short cylindrical base
//   - A washer recess on the bottom for M10 steel ballast
//   - A distinct silhouette on top
//   - Clan glyph debossed on the front (positive +y) face
//
// Silhouettes are deliberately geometric and chess-set functional. Refine
// artistically later (e.g., model proper crowns, helmets) — the priority for
// v1 is distinguishability at table distance.

module piece_base_with_ballast() {
    difference() {
        beveled_cylinder(d=PIECE_BASE_OD, h=PIECE_BASE_H);
        // M10 washer recess in the bottom
        translate([0, 0, -0.01])
            cylinder(d=PIECE_WASHER_REC_OD, h=PIECE_WASHER_REC_DEP);
    }
}

// Apply a clan glyph deboss to whatever piece body is rendered.
// The glyph sits on the front (+y) face at GLYPH_Z_FROM_BASE.
module with_clan_glyph(clan) {
    difference() {
        children();
        translate([0, PIECE_BASE_OD/2 - 1.5, GLYPH_Z_FROM_BASE])
            rotate([90, 0, 0])
                clan_glyph(clan);
    }
}

// --- Captain — tall crowned spire ---------------------------------------------
module captain_body() {
    union() {
        piece_base_with_ballast();
        // Tapered body
        translate([0, 0, PIECE_BASE_H])
            cylinder(d1=PIECE_BASE_OD * 0.85, d2=PIECE_BASE_OD * 0.55,
                     h=CAPTAIN_H - PIECE_BASE_H - 12);
        // Crown band
        translate([0, 0, CAPTAIN_H - 12])
            cylinder(d=PIECE_BASE_OD * 0.7, h=4);
        // Crown spire
        translate([0, 0, CAPTAIN_H - 8])
            cylinder(d1=PIECE_BASE_OD * 0.45, d2=2, h=8);
    }
}

// --- Pilot — swept aerodynamic profile (asymmetric, leans forward) ------------
module pilot_body() {
    union() {
        piece_base_with_ballast();
        translate([0, 0, PIECE_BASE_H]) {
            // Lower body cylinder
            cylinder(d1=PIECE_BASE_OD * 0.75, d2=PIECE_BASE_OD * 0.55,
                     h=PILOT_H * 0.55 - PIECE_BASE_H);
            // Upper sloped helmet — shifted forward to give the "lean"
            translate([0, 2, PILOT_H * 0.55 - PIECE_BASE_H])
                rotate([15, 0, 0])
                    cylinder(d1=PIECE_BASE_OD * 0.55, d2=PIECE_BASE_OD * 0.3,
                             h=PILOT_H * 0.45 - 4);
        }
    }
}

// --- Rover — low wide base with banded cylinder body --------------------------
module rover_body() {
    union() {
        piece_base_with_ballast();
        translate([0, 0, PIECE_BASE_H]) {
            // Wide body
            cylinder(d=PIECE_BASE_OD * 0.85, h=ROVER_H * 0.55 - PIECE_BASE_H);
            // Mid band
            translate([0, 0, ROVER_H * 0.55 - PIECE_BASE_H])
                cylinder(d=PIECE_BASE_OD * 0.95, h=3);
            // Top cylinder
            translate([0, 0, ROVER_H * 0.55 - PIECE_BASE_H + 3])
                cylinder(d=PIECE_BASE_OD * 0.7, h=ROVER_H * 0.45 - 8);
            // Cap
            translate([0, 0, ROVER_H - PIECE_BASE_H - 5])
                cylinder(d1=PIECE_BASE_OD * 0.7, d2=PIECE_BASE_OD * 0.3, h=5);
        }
    }
}

// --- Soldier — squat geometric body with simple cap ---------------------------
module soldier_body() {
    union() {
        piece_base_with_ballast();
        translate([0, 0, PIECE_BASE_H]) {
            // Body
            cylinder(d=PIECE_BASE_OD * 0.75, h=SOLDIER_H * 0.65 - PIECE_BASE_H);
            // Shoulders
            translate([0, 0, SOLDIER_H * 0.65 - PIECE_BASE_H])
                cylinder(d=PIECE_BASE_OD * 0.85, h=2);
            // Head
            translate([0, 0, SOLDIER_H * 0.65 - PIECE_BASE_H + 2])
                cylinder(d=PIECE_BASE_OD * 0.5, h=SOLDIER_H * 0.35 - 6);
            // Cap
            translate([0, 0, SOLDIER_H - PIECE_BASE_H - 4])
                cylinder(d1=PIECE_BASE_OD * 0.5, d2=PIECE_BASE_OD * 0.3, h=4);
        }
    }
}

module captain(clan="P1") { with_clan_glyph(clan) captain_body(); }
module pilot(clan="P1")   { with_clan_glyph(clan) pilot_body();   }
module rover(clan="P1")   { with_clan_glyph(clan) rover_body();   }
module soldier(clan="P1") { with_clan_glyph(clan) soldier_body(); }


// =============================================================================
// FLAG TOKENS — small pennant on a base; one of three per clan
// =============================================================================

module flag(clan="P1") {
    union() {
        // Base disc
        beveled_cylinder(d=FLAG_BASE_OD, h=FLAG_BASE_H, bevel=0.5);
        // Pole
        translate([0, 0, FLAG_BASE_H])
            cylinder(d=FLAG_POLE_OD, h=FLAG_POLE_H);
        // Pennant — flat triangular flag
        translate([0, 0, FLAG_BASE_H + FLAG_POLE_H - FLAG_PENNANT_H])
            difference() {
                rotate([90, 0, 0])
                    linear_extrude(FLAG_PENNANT_THK, center=true)
                        polygon(points = [
                            [0, 0],
                            [FLAG_PENNANT_W, FLAG_PENNANT_H * 0.5],
                            [0, FLAG_PENNANT_H]
                        ]);
                // Optional: clan glyph debossed on the pennant face
                translate([FLAG_PENNANT_W * 0.35,
                           FLAG_PENNANT_THK/2 + 0.01,
                           FLAG_PENNANT_H * 0.5])
                    rotate([90, 0, 0])
                        clan_glyph(clan, depth=0.5);
            }
    }
}


// =============================================================================
// PREVIEW ASSEMBLY — visual sanity check of the full stack (do not export)
// =============================================================================

module preview_assembly() {
    // Base
    base();
    // Ground board on base
    translate([0, 0, BASE_THK + BASE_DOME_DEP])
        ground_board();
    // Pillars rising from base sockets
    for (pos = pillar_positions()) {
        translate([pos[0], pos[1], BASE_THK + BASE_DOME_DEP - PILLAR_TENON_LEN + 0.5])
            pillar();
    }
    // Sky board (with pillars passing through cutouts)
    translate([0, 0, BASE_THK + BASE_DOME_DEP + BOARD_THK + 80])
        sky_board();
    // Space board on top
    translate([0, 0, BASE_THK + BASE_DOME_DEP + 2*BOARD_THK + 160])
        space_board();
    // A captain piece for scale
    color("DimGray")
        translate([cell_xy(0, 3)[0], cell_xy(0, 3)[1],
                   BASE_THK + BASE_DOME_DEP + BOARD_THK])
            captain("P1");
}


// =============================================================================
// DISPATCH — render the part selected at the top of the file
// =============================================================================

if      (PART == "ground_board")      ground_board();
else if (PART == "sky_board")         sky_board();
else if (PART == "space_board")       space_board();
else if (PART == "pillar")            pillar();
else if (PART == "base")              base();
else if (PART == "captain")           captain(CLAN);
else if (PART == "pilot")             pilot(CLAN);
else if (PART == "rover")             rover(CLAN);
else if (PART == "soldier")           soldier(CLAN);
else if (PART == "flag")              flag(CLAN);
else if (PART == "preview_assembly")  preview_assembly();
else echo("Unknown PART value:", PART);
