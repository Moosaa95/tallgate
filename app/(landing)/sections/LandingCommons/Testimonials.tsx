// "use client"
// import React from 'react';
// import {motion} from "framer-motion"

// const testimonials = [
//     {
//         text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
//         imageSrc: "path/to/image1.jpg",
//         name: "Musa Abdullahi",
//         username: "@gmmamnsa"
//     },
//     {
//         text: "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
//         imageSrc: "path/to/image2.jpg",
//         name: "Amina Suleiman",
//         username: "@aminasule"
//     },
//     {
//         text: "Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
//         imageSrc: "path/to/image3.jpg",
//         name: "John Doe",
//         username: "@johndoe"
//     },
//     {
//         text: "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
//         imageSrc: "path/to/image4.jpg",
//         name: "Jane Smith",
//         username: "@janesmith"
//     },
//     {
//         text: "Cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat.",
//         imageSrc: "path/to/image5.jpg",
//         name: "Ahmed Ibrahim",
//         username: "@ahmedibrahim"
//     },
//     {
//         text: "Proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
//         imageSrc: "path/to/image6.jpg",
//         name: "Fatima Zain",
//         username: "@fatimazain"
//     },
//     {
//         text: "Nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor.",
//         imageSrc: "path/to/image7.jpg",
//         name: "Michael Johnson",
//         username: "@michaeljohnson"
//     },
//     {
//         text: "In voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
//         imageSrc: "path/to/image8.jpg",
//         name: "Linda Lee",
//         username: "@lindalee"
//     },
//     {
//         text: "Excepteur sint occaecat cupidatat non proident.",
//         imageSrc: "path/to/image9.jpg",
//         name: "David Brown",
//         username: "@davidbrown"
//     },
//     {
//         text: "Officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet.",
//         imageSrc: "path/to/image10.jpg",
//         name: "Chinwe Okoro",
//         username: "@chinweokoro"
//     }
// ];

// export default function Testimonials() {
//     return (
//         <section className="py-10 bg-white">
//             <div className="container px-4 mx-auto">
//                 <div className="section-heading">
//                     <div className="flex justify-center">
//                         <div className="tag">Testimonials</div>
//                     </div>
//                     <h2 className="mt-5 section-title ">What our users say</h2>
//                     <p className="mt-5 section-description ">
//                         Lorem ipsum dolor sit amet consectetur adipisicing elit. Modi hic eligendi voluptatibus officiis mollitia, totam veritatis ea quaerat iste corporis quae quia repellendus illo ullam consectetur officia quis unde quos!
//                     </p>
//                 </div>
//                 <div className="grid grid-cols-1 gap-6 mt-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]">
//                     {testimonials.map((testimonial, index) => (
//                         <div key={index} className="p-10 border border-[#222222]/10 rounded-3xl  shadow-[0_7px_14px_#EAEAEA] max-w-xs w-full">
//                             <div className="flex items-center">
//                                 {testimonial.imageSrc && (
//                                     <img src={testimonial.imageSrc} alt={testimonial.name} className="w-12 h-12 mr-4 rounded-full" />
//                                 )}
//                                 <div>
//                                     <h3 className="text-lg font-semibold">{testimonial.name}</h3>
//                                     <p className="text-sm text-gray-600">{testimonial.username}</p>
//                                 </div>
//                             </div>
//                             <p className="mt-4 text-gray-700">{testimonial.text}</p>
//                         </div>
//                     ))}
//                 </div>
//             </div>
//         </section>
//     );
// }

"use client"
import React, { useEffect } from 'react';
import { motion, useAnimation } from "framer-motion";

const testimonials = [
    {
        text: "TallGate Academy has transformed my career. The instructors are knowledgeable, and the hands-on projects helped me gain real-world experience.",
        imageSrc: "path/to/sarah.jpg",
        name: "Sarah L.",
        username: "@sarahl"
    },
    {
        text: "I highly recommend TallGate Academy to anyone looking to upskill. The flexible learning options made it easy to balance my studies with work.",
        imageSrc: "path/to/john.jpg",
        name: "John D.",
        username: "@johnd"
    },
];

const Testimonials = () => {
    const controls = useAnimation();

    useEffect(() => {
        const cycleTestimonials = async () => {
            while (true) {
                await controls.start({
                    y: [0, -100 * testimonials.length],
                    transition: {
                        duration: testimonials.length * 5, // Adjust speed
                        ease: "linear",
                        loop: Infinity,
                    }
                });
            }
        };
        cycleTestimonials();
    }, [controls]);

    return (
        <section className="py-10 bg-white">
            <div className="container px-4 mx-auto">
                <div className="section-heading">
                    <div className="flex justify-center">
                        <div className="tag">Testimonials</div>
                    </div>
                    <h2 className="mt-5 section-title">What our users say</h2>
                    <p className="mt-5 section-description">
                        Discover the impact TallGate Academy has had on our students' careers and lives. Our alumni share their experiences and how our programs have helped them achieve their professional goals.
                    </p>
                </div>
                <div className="overflow-hidden relative h-[500px]">
                    <motion.div
                        className="grid grid-cols-1 gap-6 mt-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                        animate={controls}
                        style={{ maskImage: "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)" }}
                    >
                        {testimonials.map((testimonial, index) => (
                            <div key={index} className="p-10 border border-[#222222]/10 rounded-3xl shadow-[0_7px_14px_#EAEAEA] max-w-xs w-full">
                                <div className="flex items-center">
                                    {testimonial.imageSrc && (
                                        <img src={testimonial.imageSrc} alt={testimonial.name} className="w-12 h-12 mr-4 rounded-full" />
                                    )}
                                    <div>
                                        <h3 className="text-lg font-semibold">{testimonial.name}</h3>
                                        <p className="text-sm text-gray-600">{testimonial.username}</p>
                                    </div>
                                </div>
                                <p className="mt-4 text-gray-700">{testimonial.text}</p>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

export default Testimonials;
