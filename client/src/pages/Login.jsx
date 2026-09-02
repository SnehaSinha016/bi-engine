import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

export default function Login() {
  const { users, login } = useAuth();
  const [error, setError] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "KPI Intelligence: Sign in";
  }, []);

  async function handleLogin(userId) {
    setError(null);
    setLoadingId(userId);

    try {
      await login(userId);
      navigate("/");
    } catch (e) {
      setError(e.message);
      setLoadingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[var(--color-heading)]">

      {/* =====================================================
          TOP BAR
      ===================================================== */}

      <header className="flex h-16 items-center justify-between border-b border-[#E4E7EC] bg-white px-6 lg:px-10">

        <div className="flex items-center gap-3">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-ink)] text-white">
            <BarChart3 size={16} strokeWidth={1.8} />
          </div>

          <div>
            <div className="text-sm font-semibold tracking-tight">
              KPI Intelligence
            </div>

            <div className="hidden text-[9px] uppercase tracking-[0.12em] text-[var(--color-body)]/40 sm:block">
              Investigation & Decision Platform
            </div>
          </div>

        </div>

        <div className="flex items-center gap-2 text-[10px] text-[var(--color-body)]/45">

          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-green)]" />

          Demo environment

        </div>

      </header>


      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="mx-auto grid min-h-[calc(100vh-64px)] max-w-[1280px] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">

        {/* =================================================
            LEFT, PRODUCT CONTEXT
        ================================================= */}

        <section className="hidden flex-col justify-center px-10 py-16 lg:flex xl:px-16">

          <div className="max-w-xl">

            <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">

              <span className="h-px w-6 bg-[var(--color-primary)]" />

              Enterprise KPI Analytics

            </div>


            <h1 className="max-w-lg text-4xl font-semibold leading-[1.15] tracking-[-0.025em] text-[var(--color-heading)] xl:text-5xl">

              Understand what changed.
              <span className="block text-[var(--color-body)]/55">
                Decide what to do next.
              </span>

            </h1>


            <p className="mt-6 max-w-lg text-sm leading-7 text-[var(--color-body)]/65">

              Investigate KPI movements through drivers, evidence,
              historical context and governed actions, from a
              single analytical workspace.

            </p>


            {/* PRODUCT CAPABILITIES */}

            <div className="mt-10 grid max-w-lg grid-cols-2 gap-x-8 gap-y-6">

              <Feature
                icon={<TrendingUp size={15} />}
                title="KPI investigation"
                description="Trace changes to their underlying drivers."
              />

              <Feature
                icon={<Database size={15} />}
                title="Evidence & lineage"
                description="Understand where each conclusion comes from."
              />

              <Feature
                icon={<BarChart3 size={15} />}
                title="Historical memory"
                description="Compare the current situation with previous cases."
              />

              <Feature
                icon={<ShieldCheck size={15} />}
                title="Governed decisions"
                description="Keep actions tied to confidence and ownership."
              />

            </div>


            {/* SMALL STATUS LINE */}

            <div className="mt-12 flex items-center gap-2 border-t border-[#E4E7EC] pt-5 text-[9px] text-[var(--color-body)]/40">

              <CheckCircle2
                size={12}
                className="text-[var(--color-green)]"
              />

              Server-side RBAC and regional access controls enabled

            </div>

          </div>

        </section>


        {/* =================================================
            RIGHT, LOGIN
        ================================================= */}

        <section className="flex items-center justify-center px-5 py-12 sm:px-8 lg:border-l lg:border-[#E4E7EC]">

          <div className="w-full max-w-[440px]">

            {/* MOBILE BRAND */}

            <div className="mb-8 lg:hidden">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-ink)] text-white">
                  <BarChart3 size={17} />
                </div>

                <div>
                  <div className="text-sm font-semibold">
                    KPI Intelligence
                  </div>

                  <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--color-body)]/40">
                    Investigation Platform
                  </div>
                </div>

              </div>

            </div>


            {/* LOGIN HEADER */}

            <div className="mb-6">

              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-body)]/40">
                Workspace access
              </div>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-heading)]">
                Select your workspace role
              </h2>

              <p className="mt-2 text-sm leading-6 text-[var(--color-body)]/55">
                Choose a persona to explore the platform with its
                corresponding permissions and regional scope.
              </p>

            </div>


            {/* PERSONAS */}

            <div className="space-y-2">

              {users.map((u) => {

                const isLoading = loadingId === u.id;

                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={loadingId !== null}
                    onClick={() => handleLogin(u.id)}
                    className="
                      group
                      flex
                      w-full
                      items-center
                      gap-4
                      rounded-md
                      border
                      border-[#E4E7EC]
                      bg-white
                      px-4
                      py-4
                      text-left
                      shadow-sm
                      transition-all
                      duration-150
                      hover:-translate-y-[1px]
                      hover:border-[var(--color-primary)]/30
                      hover:shadow-sm
                      disabled:cursor-wait
                      disabled:opacity-60
                    "
                  >

                    {/* AVATAR */}

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-xs font-semibold uppercase text-[var(--color-body)]">

                      {getInitials(u.name || u.title)}

                    </div>


                    {/* USER INFO */}

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center gap-2">

                        <span className="truncate text-sm font-semibold text-[var(--color-heading)]">
                          {u.title}
                        </span>

                        <RoleBadge role={u.role} />

                      </div>

                      <div className="mt-1 text-[10px] text-[var(--color-body)]/50">

                        {u.name}

                        <span className="mx-1.5 text-[var(--color-body)]/25">
                          •
                        </span>

                        {u.regionScope === "all"
                          ? "All regions"
                          : cap(u.regionScope)}

                      </div>

                    </div>


                    {/* ACTION */}

                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-body)]/25 transition-all group-hover:bg-[var(--color-canvas)] group-hover:text-[var(--color-primary)]">

                      {isLoading ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-body)]/20 border-t-[var(--color-primary)]" />
                      ) : (
                        <ArrowRight size={14} />
                      )}

                    </div>

                  </button>
                );
              })}

            </div>


            {/* ERROR */}

            {error && (

              <div className="mt-4 rounded-lg border border-[var(--color-clay)]/20 bg-[var(--color-clay-soft)] px-3 py-2.5 text-xs text-[var(--color-clay)]">

                <div className="font-semibold">
                  Unable to sign in
                </div>

                <div className="mt-0.5 opacity-80">
                  {error}
                </div>

              </div>

            )}


            {/* ACCESS NOTE */}

            <div className="mt-6 border-t border-[#E4E7EC] pt-4">

              <div className="flex gap-2.5">

                <ShieldCheck
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--color-body)]/35"
                />

                <p className="text-[9px] leading-5 text-[var(--color-body)]/45">

                  Demo access only. Permissions are enforced server-side
                  through RBAC and row-level regional filtering.

                </p>

              </div>

            </div>


            {/* FOOTER */}

            <div className="mt-8 text-center text-[9px] text-[var(--color-body)]/30">

              KPI Intelligence · Internal analytics environment

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}


/* =========================================================
   FEATURE
========================================================= */

function Feature({
  icon,
  title,
  description,
}) {

  return (
    <div className="flex gap-3">

      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-[var(--color-body)]/55 shadow-sm">
        {icon}
      </div>

      <div>

        <div className="text-[11px] font-semibold text-[var(--color-heading)]">
          {title}
        </div>

        <div className="mt-1 text-[9px] leading-4 text-[var(--color-body)]/45">
          {description}
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   ROLE BADGE
========================================================= */

function RoleBadge({ role }) {

  return (
    <span className="hidden rounded-md bg-[var(--color-canvas)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[var(--color-body)]/50 sm:inline-block">
      {role}
    </span>
  );
}


/* =========================================================
   HELPERS
========================================================= */

function getInitials(name) {

  if (!name) return "?";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}


function cap(value) {

  if (!value) return "";

  return value.charAt(0).toUpperCase() + value.slice(1);
}