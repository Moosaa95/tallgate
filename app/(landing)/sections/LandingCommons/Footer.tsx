import TallGateIcon from "@/public/assets/tallgate.png"
import Image from "next/image"
import X from "@/public/assets/icons/xsocial.svg"
import LinkedIn from "@/public/assets/icons/linkedin-svgrepo.svg"
import Insta from "@/public/assets/icons/instagram-1-svgrepo-com.svg"
import Whatsapp from "@/public/assets/icons/whatsapp-color-svgrepo-co.svg"

const whatsappNumber = '+2349052440452';
const instagram = "https://www.instagram.com/tallgate_computing_enterprise/"


export default function Footer() {
    return (
        <footer className="bg-black text-[#bcbcbc] text-sm py-10 text-center">
            <div className="container">
                <div className="inline-flex relative before:content-[''] before:top-2 before:bottom-0 before:blur before:w-full before:bg-[linear-gradient(to_right,#F87BFF,#FB92CF,#FFDD9B,#C2F0B1,#2FD8FE">
                    <Image src={TallGateIcon} height={40} alt="Tall gate log" className="relative" />
                </div>
                <nav className="flex flex-col gap-6 mt-6 md:flex-row md:justify-center">
                    <a href="#">About</a>
                    <a href="#courses">Courses</a>
                </nav>
                <div className="flex flex-row justify-center gap-6 mt-6">
                <a href="#"><X className="w-10 h-10 cursor-pointer" /></a>
                <a href="#"><LinkedIn className="w-10 h-10 cursor-pointer" /></a>
                <a href={instagram}><Insta className="w-10 h-10 cursor-pointer"/></a>
                <a href={`https://wa.me/${whatsappNumber}`}><Whatsapp className="w-10 h-10 cursor-pointer" /></a>
                </div>
                <p className="mt-6">&copy; 2024 TallGate Enterprise</p>
            </div>
        </footer>
    )
}