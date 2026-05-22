import fs from "fs";

const grid = `YUTCXHAMZNADLSPY
VAAWNTAQUOUJIOZD
JLDKOYTRBICNSRGT
RRUADRSAPSPCTRNM
UUNAIEKOXNSSLYIB
CLYPSRWEXEOLIDRP
IQADZMOBRCAESAPP
NGABNGNTESALXYSV
CYTFOHUTCADKIPAO
OKTXXUNPMINAKMPL
DNANBERIWGVHYAYJ
ESKSPUCDSTARWARS
MOTHERSDAYLMIQFE
ADDFDVVSCYQLDMJK
YNOITAILICNOCERI
OYADLAIROMEMRCLD`
  .trim()
  .split(/\n/);

const words = [
  "ASCENSION",
  "CINCODEMAYO",
  "LABOURDAY",
  "MAYDAY",
  "MEMORIALDAY",
  "MOTHERSDAY",
  "NURSESDAY",
  "PENTECOST",
  "RECONCILIATION",
  "SORRYDAY",
  "SPRING",
  "STARWARS",
  "VESAK",
  "VICTORIADAY",
  "WORKERSDAY",
];

const H = grid.length;
const W = grid[0].length;
const dirs = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function findWord(w) {
  const rev = [...w].reverse().join("");
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      for (const [dr, dc] of dirs) {
        let s = "";
        for (let i = 0; i < w.length; i++) {
          const rr = r + dr * i;
          const cc = c + dc * i;
          if (rr < 0 || rr >= H || cc < 0 || cc >= W) break;
          s += grid[rr][cc];
        }
        if (s === w) return { r, c, dr, dc, kind: "fwd" };
        if (s === rev) return { r, c, dr, dc, kind: "rev" };
      }
    }
  }
  return null;
}

const out = [];
for (const w of words) {
  out.push(`${w}\t${JSON.stringify(findWord(w))}`);
}
fs.writeFileSync("C:/Users/omni/.cursor/projects/empty-window/menu-mc/wsolve_out.txt", out.join("\n"));
