// // import type {NextApiRequest, NextApiResponse} from 'next'
// import { NextRequest } from 'next/server';
// import nodemailer from 'nodemailer'

// export async function POST(req:NextRequest, res:NextResponse){
//     // console.log('hey=========', req);
    
    
//     // const {fullName, email, phone, course} = await req.body
//     // console.log('fullname====', fullName);
    
//     // const transporter  = nodemailer.createTransport({
//     //     service: "gmail",
//     //     auth: {
//     //         user: "moosaabdullahi45@gmail.com",
//     //         pass: "ekijurvfuwpvhyhh"
//     //     }
//     // })

//     // const mailOptions = {
//     //     from: email,
//     //     to: "moosaabdullahi45@gmail.com",
//     //     subject: "New Signup",
//     //     text: `
//     //         FullName: ${fullName}
//     //         email: ${email}
//     //         phone: ${phone}
//     //         course: ${course}
//     //     `
//     // };

//     // try {
//     //     await transporter.sendMail(mailOptions)
//     //     res.status(200).json({message: "Email Sent Successfully"})
//     // }catch (error) {
//     //     console.log(error);
//     //     res.status(500).json({ error: 'Failed to send email' });

//     // }
//     try {
        
//         console.log('Request Body:', req.body, process.env.EMAIL_USER);

        
//         const { fullName, email, phone, course } = await req.body;
        
        
//         if (!fullName || !email || !phone || !course) {
//             return res.status(400).json({ error: 'Missing required fields' });
//         }
        
        
//         const transporter = nodemailer.createTransport({
//             service: 'gmail',
//             auth: {
//                 user: process.env.EMAIL_USER,
//                 pass: process.env.EMAIL_PASS,
//             },
//         });

//         // Define email options
//         const mailOptions = {
//             from: email,
//             to: process.env.RECIPIENT_EMAIL,
//             subject: 'New Signup',
//             text: `
//                 Full Name: ${fullName}
//                 Email: ${email}
//                 Phone: ${phone}
//                 Course: ${course}
//             `,
//         };

//         // Send email
//         await transporter.sendMail(mailOptions);
//         return res.status(200).json({ message: 'Email Sent Successfully' });
//     } catch (error) {
//         console.error('Error sending email:', error);
//         return res.status(500).json({ error: 'Failed to send email' });
//     }
// }

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest, res: NextResponse) {
    try {
        // Parse the request body
        const { fullName, email, phone, course } = await req.json();
        
        // Log request body for debugging
        console.log('Request Body:', { fullName, email, phone, course });

        // Check for missing required fields
        if (!fullName || !email || !phone || !course) {
            return new NextResponse(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400 }
            );
        }

        // Set up nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Define email options
        const mailOptions = {
            from: email,
            to: process.env.RECIPIENT_EMAIL,
            subject: 'New Signup',
            text: `
                Full Name: ${fullName}
                Email: ${email}
                Phone: ${phone}
                Course: ${course}
            `,
        };

        // Send email
        await transporter.sendMail(mailOptions);
        return new NextResponse(
            JSON.stringify({ message: 'Email Sent Successfully' }),
            { status: 200 }
        );
    } catch (error) {
        console.error('Error sending email:', error);
        return new NextResponse(
            JSON.stringify({ error: 'Failed to send email' }),
            { status: 500 }
        );
    }
}
