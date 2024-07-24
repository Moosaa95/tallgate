import ArrowRight from "@/public/assets/icons/right-arrow.svg"


export default function CallToAction() {
    return (
        <section className="bg-gradient-to-b from-white to-[#D2DCFF] py-24">
            <div className="container">
                <div className="section-heading">
                    <h2 className="section-title" >Sign your child up today</h2>
                    <p className="mt-5 section-description">
                        Lorem, ipsum dolor sit amet consectetur adipisicing elit. Magnam sapiente placeat molestias minus magni impedit atque laudantium numquam vel voluptatem, autem amet suscipit excepturi quas voluptatibus eligendi ex, accusantium mollitia!
                    </p>
                </div>
                <div className="flex justify-center gap-2 mt-10">
                    <button className="btn btn-primary">Sign up for Free</button>
                    <button className="btn btn-text">
                        <span>Learn more</span>
                        <ArrowRight className="w-5 h-5"  />
                        </button>
                </div>
            </div>
        </section>
    )
}