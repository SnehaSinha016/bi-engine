import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

// Always-visible, on every page, the direct answer to "how do I
// know if my ingested data is being shown": this row reflects the
// SAME dataMode driving every api.js request (see AuthContext.jsx /
// lib/api.js's X-Data-Mode header), so it can never drift out of
// sync with what's actually being queried.
function DataModeIndicator() {
  const { dataMode } = useAuth();
  const navigate = useNavigate();
  const LABEL = { demo: "Demo data", userdata: "My data", combined: "Demo + my data" }[dataMode] || "Demo data";
  const isDemo = dataMode === "demo";

  return (
    <button
      onClick={() => navigate("/data-management")}
      className="mt-2 flex w-full items-center justify-between border-t border-white/[0.07] pt-2 text-left"
      title="Go to Data Management"
    >
      <span className="text-[9px] font-semibold text-white/65">Data source</span>
      <span className={`text-[8px] font-bold uppercase tracking-wider ${isDemo ? "text-white/45" : "text-[var(--color-primary)]"}`} style={isDemo ? {} : { color: "#8ea2ff" }}>
        {LABEL}
      </span>
    </button>
  );
}

/* =========================================================
   NAVIGATION
========================================================= */

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      {
        to: "/",
        label: "Executive Overview",
        icon: "dashboard",
      },
      {
        to: "/investigate/revenue",
        label: "Investigation",
        icon: "investigate",
      },
      {
        to: "/story/revenue",
        label: "KPI Story",
        icon: "story",
      },
    ],
  },

  {
    label: "Explore",
    items: [
      {
        to: "/tree",
        label: "Driver Tree",
        icon: "tree",
      },
      {
        to: "/evidence",
        label: "Evidence Explorer",
        icon: "evidence",
      },
      {
        to: "/memory",
        label: "Business Memory",
        icon: "memory",
      },
    ],
  },

  {
    label: "Act",
    items: [
      {
        to: "/actions",
        label: "Action Center",
        icon: "action",
      },
      {
        to: "/feedback",
        label: "Feedback",
        icon: "feedback",
      },
    ],
  },

  {
    label: "System",
    items: [
      {
        to: "/data-management",
        label: "Data Management",
        icon: "data",
      },
      {
        to: "/reconciliation",
        label: "Data Reconciliation",
        icon: "reconcile",
      },
      {
        to: "/telemetry",
        label: "Telemetry",
        icon: "telemetry",
      },
      {
        to: "/sparse",
        label: "Sparse Product",
        icon: "spark",
      },
    ],
  },
];


const ADMIN_NAV = {
  to: "/admin/driver-trees",
  label: "Driver Tree Admin",
  icon: "settings",
};


const DEMO_SCENARIOS = [
  {
    id: "known",
    label: "Known historical pattern",
    region: "north",
    path: "/story/revenue",
  },
  {
    id: "novel",
    label: "Novel pattern",
    region: "south",
    path: "/story/revenue",
  },
  {
    id: "ambiguous",
    label: "Ambiguous",
    region: "west",
    path: "/story/revenue",
  },
  {
    id: "sparse",
    label: "Sparse history",
    region: null,
    path: "/sparse",
  },
  {
    id: "rbac",
    label: "RBAC / security",
    region: "north",
    path: "/",
    switchUser: "u_mgr_north",
  },
];


const REGIONS_FALLBACK = [
  { id: "all", label: "All Regions" },
  { id: "north", label: "North" },
  { id: "south", label: "South" },
  { id: "west", label: "West" },
];


/* =========================================================
   MAIN SIDEBAR
========================================================= */

export default function Sidebar() {
  const {
    user,
    users,
    login,
    logout,
    region,
    setRegion,
    token,
  } = useAuth();

  const navigate = useNavigate();

  const [dynamicRegions, setDynamicRegions] = useState(null);
  const [demoOpen, setDemoOpen] = useState(false);


  /* -------------------------------------------------------
     Load regions from backend
  ------------------------------------------------------- */

  useEffect(() => {
    if (!token) return;

    api
      .metaRegions(token)
      .then(setDynamicRegions)
      .catch(() => {});
  }, [token]);


  if (!user) {
    return null;
  }


  /* -------------------------------------------------------
     Region handling
  ------------------------------------------------------- */

  const allRegions = dynamicRegions
    ? [
        {
          id: "all",
          label: "All Regions",
        },

        ...dynamicRegions
          .filter((r) => r !== "all")
          .map((r) => ({
            id: r,
            label:
              r.charAt(0).toUpperCase() +
              r.slice(1),
          })),
      ]
    : REGIONS_FALLBACK;


  const availableRegions =
    user.regionScope === "all"
      ? allRegions
      : allRegions.filter(
          (r) => r.id === user.regionScope
        );


  const canGovern =
    user.role === "analyst" ||
    user.role === "executive";


  /* -------------------------------------------------------
     Demo scenario
  ------------------------------------------------------- */

  async function runDemoScenario(scenario) {
    if (scenario.switchUser) {
      await login(scenario.switchUser);
    }

    if (scenario.region) {
      setRegion(scenario.region);
    }

    navigate(scenario.path);
  }


  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */

  return (
    <aside
      className="
        flex
        h-screen
        w-[252px]
        shrink-0
        flex-col
        overflow-hidden
        border-r
        border-white/[0.07]
        bg-[#111827]
        text-white
      "
    >

      {/* =====================================================
          BRAND
      ===================================================== */}

      <div className="px-5 pb-5 pt-6">

        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-md
              bg-[#3157e8]
              shadow-sm
            "
          >
            <BrandIcon />
          </div>


          <div className="min-w-0">

            <div className="truncate text-[13px] font-bold tracking-wide text-white">
              Decision Intelligence
            </div>

            <div className="mt-0.5 text-[9px] font-medium text-white/35">
              Business investigation platform
            </div>

          </div>

        </div>

      </div>


      {/* =====================================================
          WORKSPACE STATUS
      ===================================================== */}

      <div className="mx-4 mb-4 rounded-md border border-white/[0.07] bg-white/[0.035] px-3 py-2.5">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">

            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            <span className="text-[9px] font-semibold text-white/65">
              System status
            </span>

          </div>


          <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400">
            Online
          </span>

        </div>


        <DataModeIndicator />

      </div>


      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">

        {NAV_GROUPS.map((group) => (

          <div
            key={group.label}
            className="mb-5"
          >

            <div className="mb-1.5 px-3 text-[8px] font-bold uppercase tracking-[0.16em] text-white/25">
              {group.label}
            </div>


            <div className="space-y-0.5">

              {group.items.map((item) => (

                <SidebarLink
                  key={item.to}
                  item={item}
                />

              ))}

            </div>

          </div>

        ))}


        {/* ADMIN */}

        {canGovern && (

          <div className="border-t border-white/[0.07] pt-4">

            <div className="mb-1.5 px-3 text-[8px] font-bold uppercase tracking-[0.16em] text-white/25">
              Governance
            </div>

            <SidebarLink
              item={ADMIN_NAV}
            />

          </div>

        )}

      </nav>


      {/* =====================================================
          DEMO CONTROLS
      ===================================================== */}

      <div className="border-t border-white/[0.07] px-3 py-3">

        <button
          type="button"
          onClick={() => setDemoOpen((v) => !v)}
          className="
            flex
            w-full
            items-center
            justify-between
            rounded-lg
            px-3
            py-2
            text-left
            transition
            hover:bg-white/[0.05]
          "
        >

          <div className="flex items-center gap-2">

            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400/10 text-amber-300">
              <FlaskIcon />
            </span>

            <div>

              <div className="text-[9px] font-semibold text-white/70">
                Demo controls
              </div>

              <div className="text-[8px] text-white/25">
                Simulated scenarios
              </div>

            </div>

          </div>


          <span
            className={`
              text-[10px]
              text-white/30
              transition-transform
              ${demoOpen ? "rotate-180" : ""}
            `}
          >
            ▾
          </span>

        </button>


        {demoOpen && (

          <div className="mt-2 px-1">

            <select
              value=""
              onChange={(e) => {

                const scenario =
                  DEMO_SCENARIOS.find(
                    (s) =>
                      s.id === e.target.value
                  );

                if (scenario) {
                  runDemoScenario(
                    scenario
                  );
                }

              }}
              className="
                w-full
                rounded-lg
                border
                border-white/[0.08]
                bg-[#1a2333]
                px-2.5
                py-2
                text-[10px]
                text-white/70
                outline-none
                transition
                focus:border-[#3157e8]/60
              "
            >

              <option
                value=""
                className="bg-[#1a2333]"
              >
                Jump to scenario…
              </option>

              {DEMO_SCENARIOS.map(
                (scenario) => (

                  <option
                    key={scenario.id}
                    value={scenario.id}
                    className="bg-[#1a2333]"
                  >
                    {scenario.label}
                  </option>

                )
              )}

            </select>

          </div>

        )}

      </div>


      {/* =====================================================
          USER / CONTEXT
      ===================================================== */}

      <div className="border-t border-white/[0.07] px-3 py-3">

        {/* Region */}

        <div className="mb-3">

          <div className="mb-1.5 px-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white/25">
            Region
          </div>

          <select
            value={region}
            onChange={(e) =>
              setRegion(e.target.value)
            }
            className="
              w-full
              rounded-lg
              border
              border-white/[0.08]
              bg-white/[0.035]
              px-2.5
              py-2
              text-[10px]
              font-medium
              text-white/75
              outline-none
              transition
              hover:bg-white/[0.055]
              focus:border-[#3157e8]/50
            "
          >

            {availableRegions.map(
              (r) => (

                <option
                  key={r.id}
                  value={r.id}
                  className="bg-[#1a2333]"
                >
                  {r.label}
                </option>

              )
            )}

          </select>

        </div>


        {/* User */}

        <div
          className="
            rounded-md
            border
            border-white/[0.07]
            bg-white/[0.025]
            p-2.5
          "
        >

          <div className="flex items-center gap-2.5">

            <div
              className="
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-[#3157e8]/15
                text-[10px]
                font-bold
                text-[#8ea4ff]
              "
            >
              {(user.name || user.title || "U")
                .charAt(0)
                .toUpperCase()}
            </div>


            <div className="min-w-0 flex-1">

              <div className="truncate text-[10px] font-semibold text-white/80">
                {user.name}
              </div>

              <div className="mt-0.5 truncate text-[8px] text-white/30">
                {user.title || user.role}
              </div>

            </div>


            <button
              type="button"
              onClick={logout}
              title="Sign out"
              className="
                rounded-md
                p-1.5
                text-white/25
                transition
                hover:bg-white/[0.06]
                hover:text-white/70
              "
            >
              <LogoutIcon />
            </button>

          </div>


          {/* Persona switch */}

          {users?.length > 1 && (

            <select
              value={user.id}
              onChange={(e) =>
                login(e.target.value)
                  .then(() => navigate("/"))
              }
              className="
                mt-2
                w-full
                border-t
                border-white/[0.06]
                bg-transparent
                pt-2
                text-[8px]
                text-white/35
                outline-none
              "
            >

              {users.map((u) => (

                <option
                  key={u.id}
                  value={u.id}
                  className="bg-[#1a2333]"
                >
                  Switch persona · {u.title}
                </option>

              ))}

            </select>

          )}

        </div>

      </div>

    </aside>
  );
}


/* =========================================================
   SIDEBAR LINK
========================================================= */

function SidebarLink({ item }) {

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => `
        group
        relative
        flex
        items-center
        gap-2.5
        rounded-lg
        px-3
        py-2
        text-[10px]
        font-medium
        transition-all
        duration-150

        ${
          isActive
            ? `
              bg-[#3157e8]/12
              text-white
            `
            : `
              text-white/45
              hover:bg-white/[0.045]
              hover:text-white/80
            `
        }
      `}
    >

      {({ isActive }) => (

        <>

          {/* active indicator */}

          {isActive && (

            <span
              className="
                absolute
                -left-3
                top-1/2
                h-5
                w-0.5
                -translate-y-1/2
                rounded-r-full
                bg-[#4d6fff]
              "
            />

          )}


          <span
            className={`
              flex
              h-6
              w-6
              shrink-0
              items-center
              justify-center
              rounded-md
              transition
              ${
                isActive
                  ? "bg-[#3157e8]/15 text-[#7f96ff]"
                  : "text-white/30 group-hover:text-white/60"
              }
            `}
          >

            <NavIcon
              type={item.icon}
            />

          </span>


          <span className="truncate">
            {item.label}
          </span>


          {isActive && (

            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#5e7aff]" />

          )}

        </>

      )}

    </NavLink>
  );
}


/* =========================================================
   BRAND ICON
========================================================= */

function BrandIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >

      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />

      <path d="M5.5 5.5l2.8 2.8" />
      <path d="M15.7 15.7l2.8 2.8" />
      <path d="M18.5 5.5l-2.8 2.8" />
      <path d="M8.3 15.7l-2.8 2.8" />

      <circle
        cx="12"
        cy="12"
        r="3"
      />

    </svg>
  );
}


/* =========================================================
   NAV ICONS
========================================================= */

function NavIcon({ type }) {

  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "h-3.5 w-3.5",
  };


  switch (type) {

    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );


    case "investigate":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
          <path d="M11 8v6" />
          <path d="M8 11h6" />
        </svg>
      );


    case "story":
      return (
        <svg {...common}>
          <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5z" />
          <path d="M5 4.5v17" />
          <path d="M9 6h6" />
          <path d="M9 10h6" />
        </svg>
      );


    case "tree":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="5" rx="1" />
          <rect x="3" y="16" width="6" height="5" rx="1" />
          <rect x="15" y="16" width="6" height="5" rx="1" />
          <path d="M12 8v4" />
          <path d="M6 16v-2h12v2" />
          <path d="M18 14v-2" />
        </svg>
      );


    case "evidence":
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4.5 4.5" />
          <path d="M8 10.5h5" />
          <path d="M10.5 8v5" />
        </svg>
      );


    case "memory":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );


    case "action":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      );


    case "feedback":
      return (
        <svg {...common}>
          <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.3 8.3 0 0 1-3.3-.7L4 20l1.5-4A7.2 7.2 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7z" />
          <path d="M8 12h.01" />
          <path d="M12 12h.01" />
          <path d="M16 12h.01" />
        </svg>
      );


    case "reconcile":
      return (
        <svg {...common}>
          <path d="M8 7h11" />
          <path d="m15 3 4 4-4 4" />
          <path d="M16 17H5" />
          <path d="m9 13-4 4 4 4" />
        </svg>
      );


    case "data":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
          <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
        </svg>
      );


    case "telemetry":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 15v-3" />
          <path d="M12 15V8" />
          <path d="M16 15v-5" />
        </svg>
      );


    case "spark":
      return (
        <svg {...common}>
          <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4z" />
          <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z" />
        </svg>
      );


    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.5v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.5v-2.5h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.1H15v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );


    default:
      return null;
  }
}


/* =========================================================
   DEMO ICON
========================================================= */

function FlaskIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <path d="M9 3h6" />
      <path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" />
      <path d="M8 15h8" />
    </svg>
  );
}


/* =========================================================
   LOGOUT ICON
========================================================= */

function LogoutIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
    </svg>
  );
}