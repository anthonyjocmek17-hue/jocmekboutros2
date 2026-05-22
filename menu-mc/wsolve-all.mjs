import fs from "fs";
import path from "path";
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
  .split("\n");
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
function find(w) {
  const rev = [...w].reverse().join("");
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      for (const [dr, dc] of dirs) {
        let s = "";
        for (let i = 0; i < w.length; i++) {
          const rr = r + dr * i,
            cc = c + dc * i;
          if (rr < 0 || rr >= H || cc < 0 || cc >= W) {
            s = null;
            break;
          }
          s += grid[rr][cc];
        }
        if (!s) continue;
        if (s === w) return { r, c, dr, dc, rev: false, text: s };
        if (s === rev) return { r, c, dr, dc, rev: true, text: rev };
      }
    }
  }
  return null;
}
const results = [];
for (const w of words) {
  results.push({ w, f: find(w) });
}
const outPath = path.join(process.cwd(), "wordsearch-out.json");
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
