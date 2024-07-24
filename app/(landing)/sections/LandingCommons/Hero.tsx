import workStation1 from '@/public/assets/images/workstation1.jpg'
import workStation2 from '@/public/assets/images/workstation2.jpg'
import Image from 'next/image'
import ArrowRight from "@/public/assets/icons/right-arrow.svg"

export default function Hero() {
    return (
        <section className="pt-8 px-4 pb-20 md:pt-5 md:pb-10 bg-[radial-gradient(ellipse_200%_100%_at_bottom_left,#183EC2,#EAEEFE_100%)] overflow-x-clip">
            <div className="container">
                <div className='items-center md:flex'>
                    <div className='md:w-[478px]'>
                        <div className="tag">
                            Version 2
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-b from-black to-[#001E80] text-transparent bg-clip-text mt-6">
                            Empowering Education 
                        </h1>
                        <p className="text-xl text-[#010D3E] tracking-tight mt-6">
                        Join our platform where we teach web development and other programming skills. Our courses are tailored to help children become proficient in the latest technologies, preparing them for a successful career in the tech industry.
                        </p>
                        <div className="flex gap-1 items-center mt-[30px]">
                            <button className="btn btn-primary">Enroll Your Child Today</button>
                            <button className="gap-1 btn btn-text">
                                <span>Learn More</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="mt-20 md:mt-0 md:h-[640px] md:flex-1 relative">
                        <Image src={workStation1} alt="workstation" className='md:absolute md:h-full md:w-auto md:max-w-none md:left-6 lg:left-0 '  />
                        <Image src={workStation2} width={220} height={220} alt="workstation2" className='hidden md:block -top-8 -left-32 md:absolute'  />
                        <Image src={workStation2} width={220} height={220} alt="workstation2" className='hidden lg:block top-[524px] left-[448px] absolute rotate-[30deg]'  />
                    </div>
                </div>
            </div>
        </section>
    )
}
