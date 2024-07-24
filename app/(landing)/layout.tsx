import LandingNavbar from "./sections/LandingCommons/Navbar";




export default function LandingPageLayout ({
    children
} : {children:React.ReactNode}){


    return (
        <div className="overflow-x-hidden">
            <LandingNavbar />
            <main className="">
            {children}
            </main>
        </div>
    )
}