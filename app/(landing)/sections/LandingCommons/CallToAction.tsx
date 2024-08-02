"use client"

import { ChangeEvent, FormEvent, useState } from "react";
import Image from "next/image";
import ArrowRight from "@/public/assets/icons/right-arrow.svg";
import { motion, AnimatePresence } from "framer-motion";

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  course: string[];
}

const CallToAction = () => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    phone: "",
    course: []
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

  const courses = [
    "Computer Basic",
    "Programming Languages",
    "Web Development",
    "Data Science and Analytics",
    "Cybersecurity",
    "Desktop Publishing",
    "Digital Literacy",
    "Software & Security",
    "Graphic Design",
    "Computer Networking"
  ];

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    // const { name, value } = e.target;
    const { name, value, selectedOptions } = e.target as HTMLSelectElement;
    // setFormData({ ...formData, [name]: value });
    if (name === "course") {
      const selectedValues = Array.from(selectedOptions, option => option.value);
      setFormData({ ...formData, [name]: selectedValues });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    console.log('========', formData);
    
    try {
      const response = await fetch('/api/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setMessage("Email sent successfully!");
        setMessageType('success');
      } else {
        setMessage("Failed to send email. Please try again.");
        setMessageType('error');
      }
    } catch (error) {
        console.log('============ERROR', error);
        
      setMessage("An unexpected error occurred. Please try again.");
      setMessageType('error');
    } finally {
      setLoading(false);
      setShowModal(false);
      setTimeout(() => setMessage(null), 15000); // Hide message after 15 seconds
    }
  };

  return (
    <section className="bg-gradient-to-b from-white to-[#D2DCFF] py-24">
      <div className="container mx-auto">
        <div className="text-center section-heading">
          <h2 className="section-title">Enhance Your Digital Skills</h2>
          <p className="mt-5 section-description">
            Whether you're a beginner or looking to advance your skills, our comprehensive courses are designed for all ages. Explore subjects ranging from basic computer operations to advanced programming and more. Join us today to enhance your digital literacy and prepare for the future, no matter your age or experience level!
          </p>
        </div>
        <div className="flex justify-center gap-2 mt-10">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Sign up for Free</button>
          <button className="btn btn-text">
            <span>Learn more</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-11/12 p-6 bg-white rounded-lg md:w-1/2 lg:w-1/3"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="mb-4 text-xl font-bold">Sign Up Form</h3>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Course</label>
                  <select
                    name="course"
                    value={formData.course}
                    onChange={handleInputChange}
                    className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                    multiple
                  >
                    <option value="" disabled>Select a course</option>
                    {courses.map((course, index) => (
                      <option key={index} value={course}>
                        {course}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="mr-2 btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {loading ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success or Error Message */}
      {message && (
        <div
          className={`fixed bottom-4 right-4 p-4 rounded-md text-white ${messageType === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
        >
          {message}
        </div>
      )}
    </section>
  );
};

export default CallToAction;

// "use client";

// import { ChangeEvent, FormEvent, useState } from "react";
// import ArrowRight from "@/public/assets/icons/right-arrow.svg";
// import { motion, AnimatePresence } from "framer-motion";

// interface FormData {
//   fullName: string;
//   email: string;
//   phone: string;
//   courses: string[];
// }

// const CallToAction = () => {
//   const [showModal, setShowModal] = useState(false);
//   const [formData, setFormData] = useState<FormData>({
//     fullName: "",
//     email: "",
//     phone: "",
//     courses: [],
//   });
//   const [loading, setLoading] = useState(false);
//   const [message, setMessage] = useState<string | null>(null);
//   const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

//   const courses = [
//     "Computer Basic",
//     "Programming Languages",
//     "Web Development",
//     "Data Science and Analytics",
//     "Cybersecurity",
//     "Desktop Publishing",
//     "Digital Literacy",
//     "Software & Security",
//     "Graphic Design",
//     "Computer Networking",
//   ];

//   const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
//     const { name, value, type, checked } = e.target;
//     if (type === "checkbox") {
//       setFormData((prevFormData) => ({
//         ...prevFormData,
//         courses: checked
//           ? [...prevFormData.courses, value]
//           : prevFormData.courses.filter((course) => course !== value),
//       }));
//     } else {
//       setFormData({ ...formData, [name]: value });
//     }
//   };

//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);
//     console.log(formData, '======');
    
//     try {
//       const response = await fetch("/api/email", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(formData),
//       });
//       if (response.ok) {
//         setMessage("Email sent successfully!");
//         setMessageType("success");
//       } else {
//         setMessage("Failed to send email. Please try again.");
//         setMessageType("error");
//       }
//     } catch (error) {
//       setMessage("An unexpected error occurred. Please try again.");
//       setMessageType("error");
//     } finally {
//       setLoading(false);
//       setShowModal(false);
//       setTimeout(() => setMessage(null), 15000); // Hide message after 15 seconds
//     }
//   };

//   return (
//     <section className="bg-gradient-to-b from-white to-[#D2DCFF] py-24">
//       <div className="container">
//         <div className="text-center section-heading">
//           <h2 className="section-title">Enhance Your Digital Skills</h2>
//           <p className="mt-5 section-description">
//             Whether you're a beginner or looking to advance your skills, our comprehensive courses are designed for all ages. Explore subjects ranging from basic computer operations to advanced programming and more. Join us today to enhance your digital literacy and prepare for the future, no matter your age or experience level!
//           </p>
//         </div>
//         <div className="flex justify-center gap-2 mt-10">
//           <button className="btn btn-primary" onClick={() => setShowModal(true)}>
//             Sign up for Free
//           </button>
//           <button className="btn btn-text">
//             <span>Learn more</span>
//             <ArrowRight className="w-5 h-5" />
//           </button>
//         </div>
//       </div>

//       <AnimatePresence>
//         {showModal && (
//           <motion.div
//             className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50"
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             exit={{ opacity: 0 }}
//           >
//             <motion.div
//               className="w-11/12 p-6 bg-white rounded-lg md:w-1/2 lg:w-1/3"
//               initial={{ scale: 0.9 }}
//               animate={{ scale: 1 }}
//               exit={{ scale: 0.9 }}
//               transition={{ duration: 0.3 }}
//             >
//               <h3 className="mb-4 text-xl font-bold">Sign Up Form</h3>
//               <form onSubmit={handleSubmit}>
//                 <div className="mb-4">
//                   <label className="block text-sm font-medium text-gray-700">Full Name</label>
//                   <input
//                     type="text"
//                     name="fullName"
//                     value={formData.fullName}
//                     onChange={handleInputChange}
//                     className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
//                     required
//                   />
//                 </div>
//                 <div className="mb-4">
//                   <label className="block text-sm font-medium text-gray-700">Email</label>
//                   <input
//                     type="email"
//                     name="email"
//                     value={formData.email}
//                     onChange={handleInputChange}
//                     className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
//                     required
//                   />
//                 </div>
//                 <div className="mb-4">
//                   <label className="block text-sm font-medium text-gray-700">Phone</label>
//                   <input
//                     type="tel"
//                     name="phone"
//                     value={formData.phone}
//                     onChange={handleInputChange}
//                     className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
//                     required
//                   />
//                 </div>
//                 <div className="mb-4">
//                   <label className="block text-sm font-medium text-gray-700">Courses</label>
//                   <div className="grid grid-cols-2 gap-2">
//                     {courses.map((course, index) => (
//                       <label key={index} className="flex items-center">
//                         <input
//                           type="checkbox"
//                           name="courses"
//                           value={course}
//                           checked={formData.courses.includes(course)}
//                           onChange={handleInputChange}
//                           className="mr-2"
//                         />
//                         <span className="flex items-center">
//                           {formData.courses.includes(course) && (
//                             <svg
//                               xmlns="http://www.w3.org/2000/svg"
//                               className="w-4 h-4 mr-1 text-green-500"
//                               fill="none"
//                               viewBox="0 0 24 24"
//                               stroke="currentColor"
//                             >
//                               <path
//                                 strokeLinecap="round"
//                                 strokeLinejoin="round"
//                                 strokeWidth="2"
//                                 d="M5 13l4 4L19 7"
//                               />
//                             </svg>
//                           )}
//                           {course}
//                         </span>
//                       </label>
//                     ))}
//                   </div>
//                 </div>
//                 <div className="flex justify-end">
//                   <button
//                     type="button"
//                     className="mr-2 btn btn-secondary"
//                     onClick={() => setShowModal(false)}
//                   >
//                     Cancel
//                   </button>
//                   <button type="submit" className="btn btn-primary">
//                     {loading ? "Submitting..." : "Submit"}
//                   </button>
//                 </div>
//               </form>
//             </motion.div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {message && (
//         <div
//           className={`fixed bottom-4 right-4 p-4 rounded-md text-white ${
//             messageType === "success" ? "bg-green-500" : "bg-red-500"
//           }`}
//         >
//           {message}
//         </div>
//       )}
//     </section>
//   );
// };

// export default CallToAction;
