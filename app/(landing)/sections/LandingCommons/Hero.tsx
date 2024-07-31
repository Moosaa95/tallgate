"use client"
import workStation1 from '@/public/assets/images/workstation1.jpg'
import workStation2 from '@/public/assets/images/workstation2.jpg'
import Image from 'next/image'
import ArrowRight from "@/public/assets/icons/right-arrow.svg"
import {motion, useMotionValueEvent, useScroll, useTransform} from "framer-motion"
import { useRef } from 'react'

export default function Hero() {
    const heroRef  = useRef(null)
    const {scrollYProgress} = useScroll({
        target: heroRef,
        offset: ["start end", "end start"]
    })

    const translateY = useTransform(scrollYProgress, [0,1], [150, -150])

    // useMotionValueEvent(scrollYProgress, 'change', (latestValue) => )
    return (
        <section ref={heroRef} className="pt-8 px-4 pb-20 md:pt-5 md:pb-10 bg-[radial-gradient(ellipse_200%_100%_at_bottom_left,#183EC2,#EAEEFE_100%)] overflow-x-clip md:overflow-hidden">
            <div className="container">
                <div className='items-center justify-between gap-6 md:flex'>
                    <div className='md:w-[678px]'>
                        <div className="tag">
                            Tallgate Enterprise
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter bg-gradient-to-b from-black to-[#001E80] text-transparent bg-clip-text mt-6">
                        Welcome to TallGate Academy Your Destination for Cutting-Edge Computer Training
                        </h1>
                        <p className="text-xl text-[#010D3E] tracking-tight mt-6">
                        Master Your Tech Skills Today! Join our comprehensive computer training courses and unlock your potential. Learn from industry experts and become proficient in the latest technologies. Enroll now and start your journey to success!
                        </p>
                        <div className="flex gap-1 items-center mt-[30px]">
                            <button className="btn btn-primary">Enroll Today</button>
                            <button className="gap-1 btn btn-text">
                                <span>Learn More</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="mt-20 md:mt-0 md:h-[640px] md:flex-1 relative">
                        <motion.img 
                            animate={{
                                translateY: [-30, 30]
                            }}
                            transition={{
                                repeat: Infinity,
                                repeatType: "mirror",
                                duration: 3,
                                ease: "easeInOut"
                            }}
                            src={workStation1.src} alt="workstation" className='md:absolute md:h-full md:w-auto md:max-w-none md:left-6 lg:left-0 '  />
                        <motion.img  style={{
                            translateY: translateY
                        }} src={workStation2.src} width={220} height={220} alt="workstation2" className='hidden md:block -top-8 -left-32 md:absolute'  />
                        <Image src={workStation2} width={220} height={220} alt="workstation2" className='hidden lg:block top-[524px] left-[448px] absolute rotate-[30deg]'  />
                    </div>
                </div>
            </div>
        </section>
    )
}
