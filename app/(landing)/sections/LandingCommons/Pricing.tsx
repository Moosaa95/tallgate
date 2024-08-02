// import { twMerge } from "tailwind-merge";

// const pricingTiers = [
//     {
//         title: "Web Development",
//         monthlyPrice: "50,000", // Nigerian Naira symbol
//         buttonText: "Get Started",
//         popular: true, // You can mark this as popular if it's a recommended choice
//         inverse: false, // Adjust this based on your design needs
//         features: [
//             "Comprehensive web development curriculum",
//             "Hands-on projects and assignments",
//             "Expert-led instruction",
//             "Access to learning resources and tools",
//             "Certificate of completion"
//         ]
//     },
//     {
//         title: "Graphic Designing",
//         monthlyPrice: "45,000",
//         buttonText: "Get Started",
//         popular: false,
//         inverse: false, // Example of an alternative styling option
//         features: [
//             "Fundamentals of graphic design",
//             "Software proficiency (Adobe Photoshop, Illustrator, etc.)",
//             "Creative projects and portfolio building",
//             "Industry insights and trends",
//             "Certificate of completion"
//         ]
//     },
//     {
//         title: "Advanced Graphic Design Masterclass",
//         monthlyPrice: "60,000",
//         buttonText: "Get Started",
//         popular: true,
//         inverse: true,
//         features: [
//             "Advanced design techniques",
//             "Typography and layout principles",
//             "Client project simulations",
//             "Career guidance and portfolio review",
//             "Networking opportunities"
//         ]
//     }
// ];

// export default function Pricing() {
//     return (
//         <section className="py-24 bg-gray-100">
//             <div className="container px-4 mx-auto">
//                 <div className="section-heading">
//                     <h2 className="section-title">Explore Our Courses</h2>
//                     <p className="mt-5 section-description">Choose the perfect plan for your learning journey.</p>
//                 </div>
//                 <div className="flex flex-col items-center gap-6 mt-10 md:flex-row md:items-end md:justify-center">
//                     {pricingTiers.map(({title, monthlyPrice, buttonText, popular, inverse, features}, index) => (
//                         <div key={index} className={twMerge("p-10 border border-[#F1F1F1] rounded-3xl shadow-[0_7px_14px_#EAEAEA] max-w-xs w-full", inverse  && "border-black bg-black text-white")}>
//                             <div className="flex justify-between">
//                                 <h3 className={twMerge("text-lg font-bold text-black/50", inverse  && "text-white/60")}>{title}</h3>
//                                 {popular && (
//                                     <div className="inline-flex text-sm px-4 py-1.5 rounded-xl border border-white/20">
//                                         <span className="bg-[linear-gradient(to_right,#DD7DDF,#E1CD86,#BBCB92,#71C2Ef,#3BFFFF,#DD7DDF)] text-transparent bg-clip-text font-medium">Popular</span>
//                                     </div>
//                                 )}
//                             </div>
//                             <div className="flex items-baseline gap-1 mt-[30px]">
//                                 <span className={twMerge("text-4xl font-bold leading-none tracking-tighter", inverse && "text-white/60")}>₦{monthlyPrice}</span>
//                                 <span className={twMerge("font-bold tracking-tight text-black/50", inverse &&  "text-white/60")}>/month</span>
//                             </div>
//                             <button className={twMerge("w-full btn btn-primary mt-[30px] hover:bg-black/50",inverse  && "bg-white text-black hover:bg-gray-300" )}>{buttonText}</button>
//                             <ul className="flex flex-col gap-5 mt-8">
//                                 {features.map((feature, index) => (
//                                     <li key={index} className="flex items-center gap-4 text-sm">
//                                         <svg className="flex-shrink-0 w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
//                                          </svg>
//                                         <span>{feature}</span>
//                                     </li>
//                                 ))}
//                             </ul>
//                         </div>
//                     ))}
//                 </div>
//             </div>
//         </section>
//     )
// }


// import { twMerge } from "tailwind-merge";

// const pricingTiers = [
//     {
//         title: "Web Development",
//         monthlyPrice: "50,000",
//         buttonText: "Get Started",
//         popular: true,
//         inverse: false,
//         features: [
//             "Comprehensive web development curriculum",
//             "Hands-on projects and assignments",
//             "Expert-led instruction",
//             "Access to learning resources and tools",
//             "Certificate of completion"
//         ]
//     },
//     {
//         title: "Graphic Designing",
//         monthlyPrice: "45,000",
//         buttonText: "Get Started",
//         popular: false,
//         inverse: false,
//         features: [
//             "Fundamentals of graphic design",
//             "Software proficiency (Adobe Photoshop, Illustrator, etc.)",
//             "Creative projects and portfolio building",
//             "Industry insights and trends",
//             "Certificate of completion"
//         ]
//     },
//     {
//         title: "Advanced Graphic Design Masterclass",
//         monthlyPrice: "60,000",
//         buttonText: "Get Started",
//         popular: true,
//         inverse: true,
//         features: [
//             "Advanced design techniques",
//             "Typography and layout principles",
//             "Client project simulations",
//             "Career guidance and portfolio review",
//             "Networking opportunities"
//         ]
//     }
// ];

// export default function Pricing() {
//     return (
//         <section className="py-24 bg-gray-100">
//             <div className="container px-4 mx-auto">
//                 <div className="text-center">
//                     <h2 className="text-3xl font-extrabold text-gray-900">Explore Our Courses</h2>
//                     <p className="mt-4 text-lg text-gray-600">Choose the perfect plan for your learning journey.</p>
//                 </div>
//                 <div className="flex flex-col gap-8 mt-12 md:flex-row md:justify-center md:items-start">
//                     {pricingTiers.map(({ title, monthlyPrice, buttonText, popular, inverse, features }, index) => (
//                         <div key={index} className={twMerge("bg-white rounded-lg shadow-lg p-8 max-w-xs w-full", inverse && "bg-gray-800 text-white")}>
//                             <div className="flex items-center justify-between mb-4">
//                                 <h3 className={twMerge("text-lg font-semibold", inverse && "text-white")}>{title}</h3>
//                                 {popular && (
//                                     <span className="inline-flex items-center px-3 py-1 text-sm font-medium text-white bg-yellow-500 rounded-md">Popular</span>
//                                 )}
//                             </div>
//                             <div className="flex items-baseline mb-4">
//                                 <span className={twMerge("text-4xl font-bold mr-1", inverse && "text-white")}>₦{monthlyPrice}</span>
//                                 <span className={twMerge("text-sm font-semibold text-gray-500", inverse && "text-gray-300")}>/month</span>
//                             </div>
//                             <button className={twMerge("w-full py-2 rounded-md text-white font-semibold transition duration-300", 
//                                                         inverse ? "bg-gray-800 hover:bg-gray-700" : "bg-blue-500 hover:bg-blue-600")}>
//                                 {buttonText}
//                             </button>
//                             <ul className="mt-6 space-y-2">
//                                 {features.map((feature, index) => (
//                                     <li key={index} className="flex items-center">
//                                         <svg className="flex-shrink-0 w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
//                                         </svg>
//                                         <span className={twMerge("text-sm", inverse && "text-gray-300")}>{feature}</span>
//                                     </li>
//                                 ))}
//                             </ul>
//                         </div>
//                     ))}
//                 </div>
//             </div>
//         </section>
//     );
// }

// "use client"
// import { twMerge } from "tailwind-merge";
// import {motion} from "framer-motion"

// const courses = [
//     {
//         title: "Computer Basic",
//         description: "Perfect for beginners, this course covers essential computer operations, internet navigation, and basic software usage.",
//         monthlyPrice: "20,000",
//         buttonText: "Enroll Now",
//         popular: false
//     },
//     {
//         title: "Programming Languages",
//         description: "Learn popular programming languages like Python, Java, C++, and more. Our courses range from introductory to advanced levels.",
//         monthlyPrice: "50,000",
//         buttonText: "Enroll Now",
//         popular: true
//     },
//     {
//         title: "Web Development",
//         description: "Dive into the world of web development with courses on HTML, CSS, JavaScript, and modern frameworks like React and Angular.",
//         monthlyPrice: "50,000",
//         buttonText: "Enroll Now",
//         popular: true
//     },
//     // {
//     //     title: "Data Science and Analytics",
//     //     description: "Gain proficiency in data analysis, machine learning, and big data technologies to stay ahead in the data-driven industry.",
//     //     monthlyPrice: "60,000",
//     //     buttonText: "Enroll Now",
//     //     popular: false
//     // },
//     // {
//     //     title: "Cybersecurity",
//     //     description: "Equip yourself with the knowledge to protect systems and data with our comprehensive cybersecurity courses.",
//     //     monthlyPrice: "55,000",
//     //     buttonText: "Enroll Now",
//     //     popular: false
//     // },
//     {
//         title: "Desktop Publishing",
//         description: "Learn to create professional documents and publications using tools like Adobe InDesign, Microsoft Publisher, and more.",
//         monthlyPrice: "35,000",
//         buttonText: "Enroll Now",
//         popular: false
//     },
//     {
//         title: "Digital Literacy",
//         description: "Build a strong foundation in navigating digital environments, using internet resources, and understanding digital etiquette.",
//         monthlyPrice: "25,000",
//         buttonText: "Enroll Now",
//         popular: false
//     },
//     // {
//     //     title: "Software & Security",
//     //     description: "Understand software development and security practices to ensure robust and secure applications.",
//     //     monthlyPrice: "55,000",
//     //     buttonText: "Enroll Now",
//     //     popular: false
//     // },
//     {
//         title: "Graphic Design",
//         description: "Explore the world of graphic design with courses in Adobe Photoshop, Illustrator, and other design tools.",
//         monthlyPrice: "50,000",
//         buttonText: "Enroll Now",
//         popular: false
//     },
//     // {
//     //     title: "Computer Networking",
//     //     description: "Master the principles of networking, including setup, configuration, and troubleshooting of network systems.",
//     //     monthlyPrice: "50,000",
//     //     buttonText: "Enroll Now",
//     //     popular: false
//     // }
// ];

// export default function Courses() {
//     return (
//         <section className="py-24 bg-gray-100">
//             <div className="container px-4 mx-auto">
//                 <div className="text-center section-heading">
//                     <h2 className="text-4xl font-bold section-title">Our Courses</h2>
//                     <p className="mt-5 text-lg text-gray-600">Explore a variety of courses tailored to boost your skills and knowledge.</p>
//                 </div>
//                 <div className="flex flex-col items-center gap-6 mt-10 md:flex-row md:flex-wrap md:justify-center">
//                     {courses.map(({ title, description, monthlyPrice, buttonText, popular }, index) => (
//                         <div key={index} className={twMerge(
//                             "p-10 border border-[#F1F1F1] rounded-3xl shadow-[0_7px_14px_#EAEAEA] max-w-xs w-full bg-white",
//                             popular && "border-black bg-black text-white"
//                         )}>
//                             <div className="flex items-center justify-between">
//                                 <h3 className={twMerge("text-lg font-bold", popular ? "text-white/60" : "text-gray-800")}>
//                                     {title}
//                                 </h3>
//                                 {popular && (
//                                     <div className="inline-flex items-center text-sm px-4 py-1.5 rounded-xl border border-white/20">
//                                         <motion.span  
//                                             animate={{
//                                                 backgroundPositionX: '100%'
//                                             }}
//                                             transition={{
//                                                 duration:1,
//                                                 repeat: Infinity,
//                                                 ease: 'linear',
//                                                 repeatType: "loop"
//                                             }}
//                                             className="bg-[linear-gradient(to_right,#DD7DDF,#E1CD86,#BBCB92,#71C2Ef,#3BFFFF,#DD7DDF)] [background-size:200%] text-transparent bg-clip-text font-medium">
                                                
//                                             Popular
                                            
//                                         </motion.span>
//                                     </div>
//                                 )}
//                             </div>
//                             <p className={twMerge("mt-4 text-sm", popular ? "text-white/80" : "text-gray-600")}>
//                                 {description}
//                             </p>
//                             <div className="flex items-baseline gap-1 mt-6">
//                                 <span className={twMerge("text-4xl font-bold leading-none tracking-tighter", popular && "text-white/80")}>₦{monthlyPrice}</span>
//                                 <span className={twMerge("font-medium tracking-tight", popular ? "text-white/60" : "text-gray-600")}>/month</span>
//                             </div>
//                             {/* <button className={twMerge(
//                                 "w-full btn btn-primary mt-8 transition-transform transform hover:scale-105",
//                                 popular ? "bg-white text-black hover:bg-gray-300" : "bg-[#768de0] text-white hover:bg-[#5a6dbd]"
//                             )}>
//                                 {buttonText}
//                             </button> */}
//                         </div>
//                     ))}
//                 </div>
//             </div>
//         </section>
//     );
// }

"use client"
import { twMerge } from "tailwind-merge";
import { motion } from "framer-motion";

const courses = [
    {
        category: "Introductory",
        courses: [
            {
                title: "Computer Basic",
                description: "Perfect for beginners, this course covers essential computer operations, internet navigation, and basic software usage.",
                monthlyPrice: "20,000",
                buttonText: "Enroll Now",
                popular: false
            },
            {
                title: "Digital Literacy",
                description: "Build a strong foundation in navigating digital environments, using internet resources, and understanding digital etiquette.",
                monthlyPrice: "25,000",
                buttonText: "Enroll Now",
                popular: false
            }
        ]
    },
    {
        category: "Core Skills",
        courses: [
            {
                title: "Web Development",
                description: "Dive into the world of web development with courses on HTML, CSS, JavaScript, and modern frameworks like React and Angular.",
                monthlyPrice: "50,000",
                buttonText: "Enroll Now",
                popular: true
            },
            {
                title: "Programming Languages",
                description: "Learn popular programming languages like Python, Java, C++, and more. Our courses range from introductory to advanced levels.",
                monthlyPrice: "50,000",
                buttonText: "Enroll Now",
                popular: true
            }
        ]
    },
    {
        category: "Creative Skills",
        courses: [
            {
                title: "Graphic Design",
                description: "Explore the world of graphic design with courses in Adobe Photoshop, Illustrator, and other design tools.",
                monthlyPrice: "50,000",
                buttonText: "Enroll Now",
                popular: false
            },
            {
                title: "Desktop Publishing",
                description: "Learn to create professional documents and publications using tools like Adobe InDesign, Microsoft Publisher, and more.",
                monthlyPrice: "35,000",
                buttonText: "Enroll Now",
                popular: false
            }
        ]
    }
];

export default function Courses() {
    return (
        <section className="py-24 bg-gray-100" id="courses">
            <div className="container px-4 mx-auto">
                <div className="text-center section-heading">
                    <h2 className="text-4xl font-bold section-title">Our Courses</h2>
                    <p className="mt-5 text-lg text-gray-600">Explore a variety of courses tailored to boost your skills and knowledge.</p>
                </div>
                {courses.map(({ category, courses }, categoryIndex) => (
                    <div key={categoryIndex} className="mt-12">
                        <h3 className="text-2xl section-title">{category}</h3>
                        <div className="flex flex-col items-center gap-6 mt-6 md:flex-row md:flex-wrap md:justify-center">
                            {courses.map(({ title, description, monthlyPrice, buttonText, popular }, index) => (
                                <div key={index} className={twMerge(
                                    "p-10 border border-[#F1F1F1] rounded-3xl shadow-[0_7px_14px_#EAEAEA] max-w-xs w-full bg-white",
                                    popular && "border-black bg-black text-white"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <h3 className={twMerge("text-lg font-bold", popular ? "text-white/60" : "text-gray-800")}>
                                            {title}
                                        </h3>
                                        {popular && (
                                            <div className="inline-flex items-center text-sm px-4 py-1.5 rounded-xl border border-white/20">
                                                <motion.span  
                                                    animate={{
                                                        backgroundPositionX: '100%'
                                                    }}
                                                    transition={{
                                                        duration: 1,
                                                        repeat: Infinity,
                                                        ease: 'linear',
                                                        repeatType: "loop"
                                                    }}
                                                    className="bg-[linear-gradient(to_right,#DD7DDF,#E1CD86,#BBCB92,#71C2Ef,#3BFFFF,#DD7DDF)] [background-size:200%] text-transparent bg-clip-text font-medium">
                                                    
                                                    Popular
                                                    
                                                </motion.span>
                                            </div>
                                        )}
                                    </div>
                                    <p className={twMerge("mt-4 text-sm", popular ? "text-white/80" : "text-gray-600")}>
                                        {description}
                                    </p>
                                    <div className="flex items-baseline gap-1 mt-6">
                                        <span className={twMerge("text-4xl font-bold leading-none tracking-tighter", popular && "text-white/80")}>₦{monthlyPrice}</span>
                                        <span className={twMerge("font-medium tracking-tight", popular ? "text-white/60" : "text-gray-600")}>/month</span>
                                    </div>
                                    {/* <button className={twMerge(
                                        "w-full btn btn-primary mt-8 transition-transform transform hover:scale-105",
                                        popular ? "bg-white text-black hover:bg-gray-300" : "bg-[#768de0] text-white hover:bg-[#5a6dbd]"
                                    )}>
                                        {buttonText}
                                    </button> */}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
