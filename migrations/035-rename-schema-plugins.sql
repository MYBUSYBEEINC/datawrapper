-- Renames plugins in schema table

-- Up
UPDATE `schema` SET scope = "vis-d3-columns" WHERE scope = "visualization-column-charts";
UPDATE `schema` SET scope = "vis-tables" WHERE scope = "tables";
UPDATE `schema` SET scope = "vis-d3-maps" WHERE scope = "d3-maps";
UPDATE `schema` SET scope = "vis-d3-pies" WHERE scope = "d3-pies";

-- Down
UPDATE `schema` SET scope = "visualization-column-charts" WHERE scope = "vis-d3-columns";
UPDATE `schema` SET scope = "tables" WHERE scope = "vis-tables";
UPDATE `schema` SET scope = "d3-maps" WHERE scope = "vis-d3-maps";
UPDATE `schema` SET scope = "d3-pies" WHERE scope = "vis-d3-pies";
