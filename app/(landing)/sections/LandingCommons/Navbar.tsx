"use client"
import { usePathname, useRouter } from "next/navigation";
import NavLink from "./NavLink";
import Image from "next/image";
import Link from "next/link";

const LandingNavbar = () => {
  const pathname = usePathname();
  const router = useRouter();

  const isSelected = (path: string) => pathname === path;

  const handleLogout = () => {
    // Add your logout logic here
    console.log("Logging out...");
    router.push('/auth/login');
  };

  const authLinks = (isMobile: boolean) => (
    <>
      <NavLink
        isSelected={isSelected('/dashboard')}
        isMobile={isMobile}
        href='/dashboard'
      >
        Dashboard
      </NavLink>
      <NavLink
        isSelected={isSelected('/settings')}
        isMobile={isMobile}
        href='/settings'
      >
        Settings
      </NavLink>
      <NavLink isMobile={isMobile} onClick={handleLogout}>
        Logout
      </NavLink>
    </>
  );

  const guestLinks = (isMobile: boolean) => (
    <>
      <NavLink
        isSelected={isSelected('/auth/login')}
        isMobile={isMobile}
        href="/auth/login"
      >
        Login
      </NavLink>
      <NavLink
        isSelected={isSelected('/auth/register')}
        isMobile={isMobile}
        href="/auth/register"
      >
        Register
      </NavLink>
    </>
  );

  const isAuthenticated = false;

  return (
      <header className="sticky top-0 z-20 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-3 py-3 text-sm text-white bg-black">
          <p className="hidden text-white/60 md:block">Kubwa, Abuja. </p>
          <div className="inline-flex items-center gap-1">
            <p>Sign up for Free</p>
            {/* arrow right h-4 w-4 inline-flex justify-center items-center */}
          </div>
        </div>
        <div className="p-5">
            <div className="container">
              <div className="flex items-center justify-between">
                <Image src="/assets/tallgate.png" alt="icon" width={50} height={50} />
                {/* menu icon h-5 w-5 md:hidden*/}
                <nav className="items-center hidden gap-6 md:flex text-black/60">
                    <Link href="/home" className="text-black/60">Home</Link>
                    <Link href="/about" className="text-black/60">About</Link>
                    <Link href="/courses" className="text-black/60">Courses</Link>
                  <div className="space-x-3">
                    <button className="btn btn-primary">Signup</button>
                    <button className="btn btn-primary">Login</button>
                  </div>

                </nav>
              </div>
            </div>
        </div>
      </header>
  );
};

export default LandingNavbar;
