// export default function ProductShow(){
//     return(
//         <section className="bg-gradient-to-b from-[#fff] to-[#D2Dcff] py-24 overflow-x-clip">
//             <div className="container mx-auto">
//                 <div className="section-heading">
//                     <div className="flex justify-center">
//                         <div className="tag">
//                             Boost productivity
//                         </div>
//                     </div>
//                     <h2 className="mt-5 section-title">Why Choose Us?</h2>
//                     <p className="mt-5 max-w-[540px] mx-auto">
//                         • <span className="font-bold">Expert Instructors</span>: Learn from industry professionals with years of experience.<br/>
//                         • <span className="font-bold">Flexible Learning</span>: Choose from online or in-person classes to suit your schedule.<br/>
//                         • <span className="font-bold">Hands-On Training</span>: Engage in practical, hands-on projects to apply your knowledge.<br/>
//                         • <span className="font-bold">Certification</span>: Earn recognized certifications to enhance your career prospects.<br/>
//                         • <span className="font-bold">Supportive Community</span>: Join a network of learners and professionals for continuous growth and support.
//                     </p>
//                 </div>
//                 <div className="relative">
//                     {/* image classname=mSt-10"" */}
//                     {/* image classname="absolute hidden md:block -right-36 -top-32" h and w={262} */}
//                     {/* image classname="absolute hidden md:block bottom-24 -left-36" h and w={262} */}
//                 </div>
//             </div>
//         </section>
//     )
// }


// export default function ProductShow() {
//     return (
//         <section className="bg-gradient-to-b from-[#fff] to-[#D2Dcff] py-24 overflow-x-clip">
//             <div className="container mx-auto">
//                 <div className="text-center section-heading">
//                     <div className="inline-block px-3 py-1 text-blue-800 bg-blue-100 rounded-full tag">
//                         Boost productivity
//                     </div>
//                     <h2 className="mt-5 section-title">Why Choose Us?</h2>
//                     <ul className="mt-5 max-w-[540px] mx-auto list-disc list-inside text-center">
//                         <li className="mt-2">
//                             <span className="font-bold">Expert Instructors:</span> Learn from industry professionals with years of experience.
//                         </li>
//                         <li className="mt-2">
//                             <span className="font-bold">Flexible Learning:</span> Choose from online or in-person classes to suit your schedule.
//                         </li>
//                         <li className="mt-2">
//                             <span className="font-bold">Hands-On Training:</span> Engage in practical, hands-on projects to apply your knowledge.
//                         </li>
//                         <li className="mt-2">
//                             <span className="font-bold">Certification:</span> Earn recognized certifications to enhance your career prospects.
//                         </li>
//                         <li className="mt-2">
//                             <span className="font-bold">Supportive Community:</span> Join a network of learners and professionals for continuous growth and support.
//                         </li>
//                     </ul>
//                 </div>
//                 <div className="relative">
//                     {/* Image classnames and styles */}
//                     {/* <img src="image1.png" className="absolute hidden md:block -right-36 -top-32" style={{height: '262px', width: '262px'}} alt="Decorative Image 1" /> */}
//                     {/* <img src="image2.png" className="absolute hidden md:block bottom-24 -left-36" style={{height: '262px', width: '262px'}} alt="Decorative Image 2" /> */}
//                 </div>
//             </div>
//         </section>
//     );
// }

import { FaCheckCircle } from 'react-icons/fa';

export default function ProductShow() {
    return (
        <section className="bg-gradient-to-b from-white to-[#D2Dcff] py-12 md:py-24 px-4 overflow-x-clip">
            <div className="container mx-auto">
                <div className="section-heading">
                    <div className="inline-block px-3 py-1 text-[#768de0] bg-blue-100 rounded-full tag">
                        Boost productivity
                    </div>
                    <h2 className="mt-5 section-title">Why Choose Us?</h2>
                    <ul className="mt-5 max-w-[540px] mx-auto list-none text-center text-lg">
                        <li className="flex items-start justify-center mt-4">
                            <FaCheckCircle className="mr-2 text-[#768de0] mb-1 md:mb-0" size={24} />
                            <span>
                                <span className="font-bold">Expert Instructors:</span> Learn from industry professionals with years of experience.
                            </span>
                        </li>
                        <li className="flex items-start justify-center mt-4">
                            <FaCheckCircle className="mr-2 text-[#768de0] mb-1 md:mb-0" size={24} />
                            <span>
                                <span className="font-bold">Flexible Learning:</span> Choose from online or in-person classes to suit your schedule.
                            </span>
                        </li>
                        <li className="flex items-start justify-center mt-4">
                            <FaCheckCircle className="mr-2 text-[#768de0] mb-1 md:mb-0" size={24} />
                            <span>
                                <span className="font-bold">Hands-On Training:</span> Engage in practical, hands-on projects to apply your knowledge.
                            </span>
                        </li>
                        <li className="flex items-start justify-center mt-4">
                            <FaCheckCircle className="mr-2 text-[#768de0] mb-1 md:mb-0" size={24} />
                            <span>
                                <span className="font-bold">Certification:</span> Earn recognized certifications to enhance your career prospects.
                            </span>
                        </li>
                        <li className="flex items-start justify-center mt-4">
                            <FaCheckCircle className="mr-2 text-[#768de0] mb-1 md:mb-0" size={24} />
                            <span>
                                <span className="font-bold">Supportive Community:</span> Join a network of learners and professionals for continuous growth and support.
                            </span>
                        </li>
                    </ul>
                </div>
                <div className="relative mt-12">
                    {/* Add images or other decorative elements here */}
                </div>
            </div>
        </section>
    );
}
