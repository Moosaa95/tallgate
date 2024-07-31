"use client"
import Image from "next/image";
import Link from "next/link";
import {motion} from "framer-motion"

const LandingNavbar = () => {
 

  return (
      <header className="sticky top-0 z-20 backdrop-blur-sm">
        <div className="bg-black">
          <motion.div
            className="flex items-center justify-center gap-3 py-3 text-sm text-white"
            animate={{ x: ["0%", "-97%"] }}
            transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
          >

            <p className="hidden text-white/90 md:block"><span className="font-bold">Email:</span>support@TallGateacademy.com </p>
            <div className="inline-flex items-center gap-1 space-x-10">
              <p><span>Phone:</span>1-800-123-4567</p>
              <p><span>Address:</span>123 Tech Street, Innovation City, TX</p>
              <p>Sign up for Free</p>
              {/* arrow right h-4 w-4 inline-flex justify-center items-center */}
            </div>
          </motion.div>
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

