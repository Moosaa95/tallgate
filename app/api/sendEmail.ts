import type {NextApiRequest, NextApiResponse} from 'next'
import nodemailer from 'nodemailer'

export default async function handler(req:NextApiRequest, res:NextApiResponse){
    if (req.method === 'POST'){
        const {fullName, email, phone, course} = req.body

        const transporter  = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: "moosaabdullahi45@gmail.com",
                pass: "ekijurvfuwpvhyhh"
            }
        })

        const mailOptions = {
            from: email,
            to: "moosaabdullahi45@gmail.com",
            subject: "New Signup",
            text: `
                FullName: ${fullName}
                email: ${email}
                phone: ${phone}
                course: ${course}
            `
        };

        try {
            await transporter.sendMail(mailOptions)
            res.status(200).json({message: "Email Sent Successfully"})
        }catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Failed to send email' });

        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} not allowed`);
      }
}