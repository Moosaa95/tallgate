"use client"
import Image from "next/image";
import Link from "next/link";
import {motion} from "framer-motion"
import { useState, useRef} from "react";
// import { HiMenu } from "react-icons/hi";
// import { FaTimes } from "react-icons/fa";
import { MdOutlineClose } from "react-icons/md";


const LandingNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null);


  const handleScroll = (e:React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault()
    setShow(false)
    const href = e.currentTarget.href;
    const targetId = href.replace(/.*\#/, "")
    const elem = document.getElementById(targetId)
    console.log(href, targetId, elem, '==========>>>>>>>>>');
    
    elem?.scrollIntoView({
      behavior: "smooth",
    })

    const links = document.querySelectorAll('.nav-link')
    links.forEach((link) => {
      link.classList.remove('active')
    })
    e.currentTarget.classList.add("active")
  }
 
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  function handleClick(e:any){
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setShow(false);
    }
  }


  return (
      <header className="sticky top-0 z-20 backdrop-blur-sm">
        <div className="bg-black">
          <motion.div
            className="flex items-center justify-center gap-3 py-3 text-sm text-white"
            animate={{ x: ["0%", "-97%"] }}
            transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
          >

            <p className="hidden text-white/90 md:block"><span className="font-bold">Email:</span>support@TallGateacademy.com </p>
            <div className="flex items-center gap-1 space-x-10">
              <p><span>Phone:</span>+2349052440452, +2347052869461</p>
              <p><span>Email:</span>Tallgatecomputingenterprise@gmail.com</p>
              <p className="hidden md:block"><span>Address:</span>No. 2 F.O.Eburuche close, gbazango extension, kubwa Abuja</p>
              <p className="hidden md:block">Sign up for Free</p>
              {/* arrow right h-4 w-4 inline-flex justify-center items-center */}
            </div>
          </motion.div>
        </div>
        
        <div className="flex items-center justify-between h-full px-2 py-1 mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Image className="w-14" src="/assets/tallgate.png" alt="logo" width={50} height={50} />
        </motion.div>
        <div className="items-center hidden md:px-10 md:inline-flex gap-7">
          <ul className="flex gap-4 text-[13px]">
            <Link
              href="#home"
              onClick={handleScroll}
              className="flex items-center gap-1 font-medium text-black duration-300 cursor-pointer hover:text-black/60"
            >
              <motion.li
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.1 }}
              >
                Home
              </motion.li>
            </Link>
            <Link
              href="#why"
              onClick={handleScroll}
              className="flex items-center gap-1 font-medium text-black duration-300 cursor-pointer hover:text-black/60"
            >
              <motion.li
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.1, delay: 0.1 }}
              >
                Why Choose us
              </motion.li>
            </Link>
            <Link
              href="#courses"
              onClick={handleScroll}
              className="flex items-center gap-1 font-medium text-black duration-300 cursor-pointer hover:text-black/60"
            >
              <motion.li
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.1, delay: 0.2 }}
              >
                Courses
              </motion.li>
            </Link>
          </ul>
          <a href="/comingsoon">
            <motion.button
              className="px-4 rounded-md text-[13px] btn btn-primary duration-300"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Login
            </motion.button>
          </a>
        </div>
        {/* icon */}
        <div 
            className="flex flex-col items-center justify-between w-8 h-8 overflow-hidden text-4xl text-blue-600 cursor-pointer md:hidden group"
            onClick={() => setShow(true)}
            >
          <span className="w-full h-[2px] bg-blue-700 inline-flex transform group-hover:translate-x-2 transition-all ease-in-out duration-300"></span>
          <span className="w-full h-[2px] bg-blue-700 inline-flex transform translate-x-3 group-hover:translate-x-0 transition-all ease-in-out duration-300"></span>
          <span className="w-full h-[2px] bg-blue-700 inline-flex transform translate-x-1 group-hover:translate-x-3 transition-all ease-in-out duration-300"></span>
        </div>
        {show && (
          <div
            ref={ref}
          onClick={handleClick}
          className="absolute top-0 right-0 flex flex-col items-end w-full h-screen bg-black bg-opacity-50 md:hidden"
        >
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="w-[80%] h-full overflow-y-scroll scrollbarHide bg-[#112240] flex flex-col items-center px-4 py-10 relative"
          >
            <MdOutlineClose
              onClick={() => setShow(false)}
              className="absolute text-3xl text-white cursor-pointer hover:text-red-500 top-4 right-4"
            />
            <div className="flex flex-col items-center gap-7">
              <ul className="flex flex-col text-base gap-7">
                <Link
                  className="flex items-center gap-1 font-medium text-white duration-300 cursor-pointer hover:text-white/60"
                  href="#home"
                  onClick={handleScroll}
                >
                  <motion.li
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.1, ease: "easeIn" }}
                  >
                    Home
                  </motion.li>
                </Link>

                <Link
                  className="flex items-center gap-1 font-medium text-white duration-300 cursor-pointer hover:text-white/60"
                  href="#why"
                  onClick={handleScroll}
                >
                  <motion.li
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.2, ease: "easeIn" }}
                  >
                    
                    Why choose us
                  </motion.li>
                </Link>
                <Link
                  className="flex items-center gap-1 font-medium text-white duration-300 cursor-pointer hover:text-white/60"
                  href="#courses"
                  onClick={handleScroll}
                >
                  <motion.li
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.3, ease: "easeIn" }}
                  >
                   
                    Courses
                  </motion.li>
                </Link>
                
                <Link
                  className="flex items-center gap-1 font-medium text-white duration-300 cursor-pointer hover:text-white/60"
                  href="#contact"
                  onClick={handleScroll}
                >
                  <motion.li
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.5, ease: "easeIn" }}
                  >
                    
                    Contact
                  </motion.li>
                </Link>
              </ul>
              <a href="/comingsoon" target="_blank">
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, ease: "easeIn" }}
                  className="w-32 h-10 rounded-md  text-[20px] border border-gray-500 text-white hover:text-white/60 duration-300"
                >
                  Login
                </motion.button>
              </a>
            </div>

          </motion.div>
        </div>
        )}
      </div>
      </header>
  );
};

export default LandingNavbar;

{/* <div className="p-5">
            <div className="container">
              <div className="flex items-center justify-between">
                <Image src="/assets/tallgate.png" alt="icon" width={50} height={50} />
                <button className="md:hidden" onClick={toggleMenu}>
                  {isMenuOpen ? (
                    <FaTimes className="w-5 h-5 text-black" />
                  ) : (
                    <HiMenu className="w-5 h-5 text-black" />
                  )}
                </button>
                <nav className={`items-center gap-6 md:flex ${isMenuOpen ? 'block' : 'hidden'} text-black/60`}>
                    <Link href="#home" className="block md:inline text-black/60">Home</Link>
                    <Link href="#about" className="block md:inline text-black/60">About</Link>
                    <Link href="#courses" className="block md:inline text-black/60">Courses</Link>
                  <div className="space-x-3">
                    <button className="btn btn-primary">Signup</button>
                    <button className="btn btn-primary">Login</button>
                  </div>

                </nav>
              </div>
            </div>
        </div> */}