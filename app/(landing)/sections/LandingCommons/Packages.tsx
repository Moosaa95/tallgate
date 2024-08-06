// import { Basic } from "next/font/google";
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

// import { useState } from "react";
// import { twMerge } from "tailwind-merge";

// const pricingTiers = [
//     {
//         title: "Basic Appreciation Package",
//         monthlyPrice: "50,000", // Nigerian Naira symbol
//         buttonText: "Get Started",
//         popular: false, 
//         inverse: false, 
//         features: [
//             "Computer Basics: Introduction to computers, hardware and software fundamentals",
//             "Digital Literacy: Essential skills for using computers and the internet effectively",
//             "Data Communication: Basics of data transfer and network communication",
//             "Desktop Applications: Practical skills in using office software (Word, Excel, PowerPoint)",
//             "Desktop Publishing: Introduction to designing and creating documents using publishing software"
//         ]
//     },
//     {
//         title: "Advanced Computing Package",
//         monthlyPrice: "100,000",
//         buttonText: "Get Started",
//         popular: true,
//         inverse: false, 
//         features: [
//             "Computer Basics: A deeper dive into computer fundamentals",
//             "Digital Literacy: Advanced skills for efficient and safe internet usage",
//             "Desktop Publishing: Enhanced skills for professional document design",
//             "Software & Security: Understanding and implementing basic security measures",
//             "Computer Networking: Basics of setting up and managing networks",
//             "Graphic Design: Fundamentals of creating visual content using design software"
//         ]
//     },
//     {
//         title: "Cyber Security Package",
//         monthlyPrice: "100,000",
//         buttonText: "Get Started",
//         popular: false,
//         inverse: false,
//         features: [
//             "Computer Basics: Comprehensive understanding of computers",
//             "Digital Literacy: Ensuring safe and efficient use of digital tools",
//             "Software & Security: Advanced security measures and practices",
//             "Cyber Security: Protecting systems and networks from cyber threats",
//             "Computer Networking: Intermediate to advanced networking skills"
//         ]
//     },
//     {
//         title: "Web Development Package",
//         monthlyPrice: "150,000",
//         buttonText: "Get Started",
//         popular: true,
//         inverse: true,
//         features: [
//             "Computer Basics: Essential knowledge for working with computers",
//             "Digital Literacy: Proficiency in digital tools and internet usage",
//             "Web Development: Building and maintaining websites (HTML, CSS, JavaScript)",
//             "Backend Programming: Introduction to server-side programming and databases"
//         ]
//     },
//     {
//         title: "Programming Fundamentals Package",
//         monthlyPrice: "150,000",
//         buttonText: "Get Started",
//         popular: false,
//         inverse: false,
//         features: [
//             "Computer Basics: Foundational computer skills",
//             "Digital Literacy: Effective and safe use of digital tools",
//             "Programming Languages: Introduction to various programming languages (Python, Java, C++)",
//             "Software Development: Basics of developing and deploying software applications"
//         ]
//     },
//     {
//         title: "Digital Skills Package",
//         monthlyPrice: "150,000",
//         buttonText: "Get Started",
//         popular: true,
//         inverse: true,
//         features: [
//             "Computer Basics: Core skills for using computers",
//             "Digital Literacy: Advanced digital skills for everyday use",
//             "Graphic Design: Creating professional visual content",
//             "Digital Marketing: Strategies and tools for online marketing",
//             "Data Science: Introduction to data analysis and visualization"
//         ]
//     }
// ];

// export default function Packages() {
//     const [selectedPackage, setSelectedPackage] = useState(null);
//     const [showModal, setShowModal] = useState(false);
//     const [formData, setFormData] = useState({ name: "", email: "", phone: "" });

//     const openModal = (pkg) => {
//         setSelectedPackage(pkg);
//         setShowModal(true);
//     };

//     const handleClose = () => {
//         setShowModal(false);
//         setFormData({ name: "", email: "", phone: "" });
//     };

//     const handleChange = (e) => {
//         const { name, value } = e.target;
//         setFormData((prevState) => ({ ...prevState, [name]: value }));
//     };

//     const handleSubmit = (e) => {
//         e.preventDefault();
//         console.log("Form Data: ", formData, "Selected Package: ", selectedPackage);
//         handleClose();
//     };

//     return (
//         <section className="py-24 bg-gray-100">
//             <div className="container px-4 mx-auto">
//                 <div className="section-heading">
//                     <h2 className="section-title">Explore Our Packages</h2>
//                     <p className="mt-5 section-description">Choose the perfect plan for your learning journey.</p>
//                 </div>
//                 <div className="grid gap-6 mt-10 border-4 border-red-700 justify-items-center md:grid-cols-3 md:justify-center">
//                     {pricingTiers.map(({title, monthlyPrice, buttonText, popular, inverse, features}, index) => (
//                         <div key={index} className={twMerge("p-10 border border-[#F1F1F1] rounded-3xl shadow-[0_7px_14px_#EAEAEA] max-w-xs w-full", inverse && "border-black bg-black text-white")}>
//                             <div className="flex justify-between">
//                                 <h3 className={twMerge("text-lg font-bold text-black/50", inverse && "text-white/60")}>{title}</h3>
//                                 {popular && (
//                                     <div className="inline-flex text-sm px-4 py-1.5 rounded-xl border border-white/20">
//                                         <span className="bg-[linear-gradient(to_right,#DD7DDF,#E1CD86,#BBCB92,#71C2Ef,#3BFFFF,#DD7DDF)] text-transparent bg-clip-text font-medium">Popular</span>
//                                     </div>
//                                 )}
//                             </div>
//                             <div className="flex items-baseline gap-1 mt-[30px]">
//                                 <span className={twMerge("text-4xl font-bold leading-none tracking-tighter", inverse && "text-white/60")}>₦{monthlyPrice}</span>
//                                 <span className={twMerge("font-bold tracking-tight text-black/50", inverse && "text-white/60")}>/month</span>
//                             </div>
//                             <button className={twMerge("w-full btn btn-primary mt-[30px] hover:bg-black/50", inverse && "bg-white text-black hover:bg-gray-300")}>{buttonText}</button>
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
//                 {showModal && (
//                     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
//                         <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
//                             <h2 className="text-xl font-bold mb-4">Register for {selectedPackage.title}</h2>
//                             <form onSubmit={handleSubmit}>
//                                 <div className="mb-4">
//                                     <label className="block text-sm font-medium text-gray-700">Name</label>
//                                     <input
//                                         type="text"
//                                         name="name"
//                                         value={formData.name}
//                                         onChange={handleChange}
//                                         required
//                                         className="mt-1 p-2 border border-gray-300 rounded-md w-full"
//                                     />
//                                 </div>
//                                 <div className="mb-4">
//                                     <label className="block text-sm font-medium text-gray-700">Email</label>
//                                     <input
//                                         type="email"
//                                         name="email"
//                                         value={formData.email}
//                                         onChange={handleChange}
//                                         required
//                                         className="mt-1 p-2 border border-gray-300 rounded-md w-full"
//                                     />
//                                 </div>
//                                 <div className="mb-4">
//                                     <label className="block text-sm font-medium text-gray-700">Phone</label>
//                                     <input
//                                         type="text"
//                                         name="phone"
//                                         value={formData.phone}
//                                         onChange={handleChange}
//                                         required
//                                         className="mt-1 p-2 border border-gray-300 rounded-md w-full"
//                                     />
//                                 </div>
//                                 <div className="flex justify-end gap-4">
//                                     <button type="button" onClick={handleClose} className="btn btn-secondary">
//                                         Cancel
//                                     </button>
//                                     <button type="submit" className="btn btn-primary">
//                                         Submit
//                                     </button>
//                                 </div>
//                             </form>
//                         </div>
//                     </div>
//                 )}
//             </div>
//         </section>
//     )
// }

// Pricing.tsx
"use client"
import React, { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import Modal from '../modal/Modal';


interface Package {
  title: string;
  monthlyPrice: string;
  buttonText: string;
  popular: boolean;
  inverse: boolean;
  features: string[];
}

const pricingTiers: Package[] = [
  {
    title: "Basic Appreciation Package",
    monthlyPrice: "50,000",
    buttonText: "Get Started",
    popular: false,
    inverse: false,
    features: [
      "Computer Basics: Introduction to computers, hardware and software fundamentals",
      "Digital Literacy: Essential skills for using computers and the internet effectively",
      "Data Communication: Basics of data transfer and network communication",
      "Desktop Applications: Practical skills in using office software (Word, Excel, PowerPoint)",
      "Desktop Publishing: Introduction to designing and creating documents using publishing software"
    ]
  },
  {
    title: "Advanced Computing Package",
    monthlyPrice: "100,000",
    buttonText: "Get Started",
    popular: true,
    inverse: false,
    features: [
      "Computer Basics: A deeper dive into computer fundamentals",
      "Digital Literacy: Advanced skills for efficient and safe internet usage",
      "Desktop Publishing: Enhanced skills for professional document design",
      "Software & Security: Understanding and implementing basic security measures",
      "Computer Networking: Basics of setting up and managing networks",
      "Graphic Design: Fundamentals of creating visual content using design software"
    ]
  },
  {
    title: "Cyber Security Package",
    monthlyPrice: "100,000",
    buttonText: "Get Started",
    popular: false,
    inverse: false,
    features: [
      "Computer Basics: Comprehensive understanding of computers",
      "Digital Literacy: Ensuring safe and efficient use of digital tools",
      "Software & Security: Advanced security measures and practices",
      "Cyber Security: Protecting systems and networks from cyber threats",
      "Computer Networking: Intermediate to advanced networking skills"
    ]
  },
  {
    title: "Web Development Package",
    monthlyPrice: "150,000",
    buttonText: "Get Started",
    popular: true,
    inverse: true,
    features: [
      "Computer Basics: Essential knowledge for working with computers",
      "Digital Literacy: Proficiency in digital tools and internet usage",
      "Web Development: Building and maintaining websites (HTML, CSS, JavaScript)",
      "Backend Programming: Introduction to server-side programming and databases"
    ]
  },
  {
    title: "Programming Fundamentals Package",
    monthlyPrice: "150,000",
    buttonText: "Get Started",
    popular: false,
    inverse: false,
    features: [
      "Computer Basics: Foundational computer skills",
      "Digital Literacy: Effective and safe use of digital tools",
      "Programming Languages: Introduction to various programming languages (Python, Java, C++)",
      "Software Development: Basics of developing and deploying software applications"
    ]
  },
  {
    title: "Digital Skills Package",
    monthlyPrice: "150,000",
    buttonText: "Get Started",
    popular: true,
    inverse: true,
    features: [
      "Computer Basics: Core skills for using computers",
      "Digital Literacy: Advanced digital skills for everyday use",
      "Graphic Design: Creating professional visual content",
      "Digital Marketing: Strategies and tools for online marketing",
      "Data Science: Introduction to data analysis and visualization"
    ]
  }
];

export default function Packages() {
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = (pkg: Package) => {
    setSelectedPackage(pkg);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedPackage(null);
    setIsModalOpen(false);
  };

  return (
    <section className="py-24 bg-gray-100">
      <div className="container px-4 mx-auto">
        <div className="section-heading">
          <h2 className="section-title">Explore Our Packages</h2>
          <p className="mt-5 section-description">Choose the perfect plan for your learning journey.</p>
        </div>
        <div className="grid gap-6 mt-10 justify-items-center md:grid-cols-3 md:justify-center">
          {pricingTiers.map((pkg, index) => (
            <div
              key={index}
              className={twMerge(
                "p-10 border border-[#F1F1F1] rounded-3xl shadow-[0_7px_14px_#EAEAEA] max-w-xs w-full",
                pkg.inverse && "border-black bg-black text-white"
              )}
            >
              <div className="flex justify-between">
                <h3 className={twMerge("text-lg font-bold text-black/50", pkg.inverse && "text-white/60")}>{pkg.title}</h3>
                {pkg.popular && (
                  <div className="inline-flex text-sm px-4 py-1.5 rounded-xl border border-white/20">
                    <span className="bg-[linear-gradient(to_right,#DD7DDF,#E1CD86,#BBCB92,#71C2Ef,#3BFFFF,#DD7DDF)] text-transparent bg-clip-text font-medium">Popular</span>
                  </div>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-[30px]">
                <span className={twMerge("text-4xl font-bold leading-none tracking-tighter", pkg.inverse && "text-white/60")}>₦{pkg.monthlyPrice}</span>
                <span className={twMerge("font-bold tracking-tight text-black/50", pkg.inverse && "text-white/60")}>/month</span>
              </div>
              <button
                className={twMerge("w-full btn btn-primary mt-[30px] hover:bg-black/50", pkg.inverse && "bg-white text-black hover:bg-gray-300")}
                onClick={() => handleOpenModal(pkg)}
              >
                {pkg.buttonText}
              </button>
              <ul className="flex flex-col gap-5 mt-8">
                {pkg.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-4 text-sm">
                    <svg className="flex-shrink-0 w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {isModalOpen && selectedPackage && (
        <Modal isOpen={isModalOpen} onClose={handleCloseModal} selectedPackage={selectedPackage} />
      )}
    </section>
  );
}
