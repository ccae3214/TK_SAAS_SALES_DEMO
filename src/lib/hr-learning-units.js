// 依「場合分類」把單元分組（相鄰、分類相同的單元放同一組），單元清單用分類標題分段顯示。
// label 決定分類名稱（例如依語言挑中文或英文）；沒有分類的單元 category 是空字串。
export function groupUnitsByCategory(units = [], label = unit => unit.category || '') {
  const groups = [];
  units.forEach((unit, index) => {
    const category = label(unit) || '';
    const last = groups[groups.length - 1];
    if (last && last.category === category) last.items.push({ unit, index });
    else groups.push({ category, items: [{ unit, index }] });
  });
  return groups;
}
