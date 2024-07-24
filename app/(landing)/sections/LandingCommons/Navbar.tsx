"use client"
import Image from "next/image";
import Link from "next/link";

const LandingNavbar = () => {
 

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
