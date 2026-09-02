// Demo users for the persona / RBAC switcher. In a real system
// this would be backed by an identity provider; here it's a fixed
// list so the security demo is reproducible.
export const USERS = [
  {
    id: "u_exec",
    name: "Priya Menon",
    role: "executive",
    title: "VP, Revenue",
    regionScope: "all", // aggregated, all-region access
    dataDetail: "aggregated",
  },
  {
    id: "u_mgr_north",
    name: "Arjun Rao",
    role: "manager",
    title: "Regional Manager, North",
    regionScope: "north", // row-level filter: only own region
    dataDetail: "regional",
  },
  {
    id: "u_mgr_south",
    name: "Fatima Sheikh",
    role: "manager",
    title: "Regional Manager, South",
    regionScope: "south",
    dataDetail: "regional",
  },
  {
    id: "u_analyst",
    name: "Dev Kulkarni",
    role: "analyst",
    title: "BI Analyst",
    regionScope: "all",
    dataDetail: "detailed", // full row-level + lineage access
  },
];

export function findUser(userId) {
  return USERS.find((u) => u.id === userId);
}
