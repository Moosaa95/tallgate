import LandingNavbar from "./sections/LandingCommons/Navbar";




export default function LandingPageLayout ({
    children
} : {children:React.ReactNode}){


    return (
        <div className="">
            <LandingNavbar />
            <main className="overflow-x-hidden overflow-y-scroll scrollbar scrollbar-track-textDark/20 scrollbar-thumb-textDark/60">
            {children}
            </main>
        </div>
    )
}