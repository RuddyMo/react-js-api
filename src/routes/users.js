import {
    getUserById,
    getUsers,
    loginUser,
    registerUser,
} from "../controllers/users.js";

import nodemailer from 'nodemailer';
import mjml from 'mjml';
import User from "../models/users.js";
import {Op} from "sequelize";

const getConfirmationEmailTemplate = (firstName, confirmationLink) => {
    const mjmlTemplate = `
    <mjml>
      <mj-body background-color="#f4f4f4">
        <!-- Header Section -->
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column width="100%">
            <mj-text align="center" color="#333333" font-size="24px" font-weight="bold" padding="0">Confirmation de compte</mj-text>
            <mj-divider border-color="#d1d1d1" border-width="1px" padding-top="10px" padding-bottom="10px"></mj-divider>
          </mj-column>
        </mj-section>
    
        <!-- Greeting Section -->
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column width="100%">
            <mj-text align="left" color="#333333" font-size="18px" padding="0">Bonjour ${firstName},</mj-text>
            <mj-text align="left" color="#555555" font-size="16px" padding-top="10px">
              Merci d'avoir créé un compte chez nous. Veuillez confirmer votre compte en cliquant sur le bouton ci-dessous :
            </mj-text>
          </mj-column>
        </mj-section>
    
        <!-- Call to Action Button -->
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column width="100%" vertical-align="middle">
            <mj-button background-color="#4CAF50" color="#ffffff" font-size="18px" font-weight="bold" border-radius="5px" padding="15px 30px" href="${confirmationLink}">
              Confirmer mon compte
            </mj-button>
          </mj-column>
        </mj-section>
    
        <!-- Additional Information Section -->
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column width="100%">
            <mj-text align="left" color="#555555" font-size="14px">
              Si vous n'avez pas créé de compte, veuillez ignorer cet e-mail. Ce lien expirera dans 24 heures.
            </mj-text>
          </mj-column>
        </mj-section>
    
        <!-- Footer Section -->
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column width="100%">
            <mj-divider border-color="#d1d1d1" border-width="1px" padding-top="10px" padding-bottom="10px"></mj-divider>
            <mj-text align="center" color="#777777" font-size="14px">
              Cordialement,<br />L'équipe [[CompanyName]]
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;

    const htmlOutput = mjml(mjmlTemplate);
    return htmlOutput.html;
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ruddymorel10@gmail.com',
        pass: 'zlou inqd jumz aook',
    },
});

export function usersRoutes(app) {
    app.post("/login", async (request, reply) => {
        reply.send(await loginUser(request.body, app));
    }).post(
        "/logout",
        {preHandler: [app.authenticate]},
        async (request, reply) => {
            const token = request.headers["authorization"].split(" ")[1];

            blacklistedTokens.push(token);

            reply.send({logout: true});
        }
    );

    app.post("/register", async (request, reply) => {
        const user = await registerUser(request.body, app.bcrypt);

        if (user) {
            const confirmationLink = `http://localhost:3000/confirm?token=${user.confirmationToken}`;

            const emailHtml = getConfirmationEmailTemplate(user.firstName, confirmationLink);

            const mailOptions = {
                from: 'ruddymorel10@gmail.com',
                to: user.email,
                subject: 'Confirm your account',
                html: emailHtml,
            };

            await transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Error sending confirmation email:', error);
                    reply.status(500).send({message: 'Error sending confirmation email'});
                } else {
                    console.log('Confirmation email sent:', info.response);
                    reply.send({message: 'User registered. Please check your email for confirmation.'});
                }
            });
        } else {
            reply.status(400).send({message: 'User registration failed'});
        }
    });

    app.get("/confirm", async (request, reply) => {
        const {token} = request.query;

        if (!token) {
            return reply.status(400).send({message: 'Token is missing'});
        }

        const user = await User.findOne({
            where: {
                confirmationToken: token,
                confirmationTokenExpires: {
                    [Op.gt]: new Date(),
                }
            }
        });

        if (!user) {
            return reply.status(400).send({message: 'Invalid or expired token'});
        }

        user.verified = true;
        user.confirmationToken = null;
        user.confirmationTokenExpires = null;
        await user.save();

        reply.send({message: 'Account confirmed successfully'});
    });


    app.get("/users", async (request, reply) => {
        reply.send(await getUsers());
    });

    app.get("/users/:id", async (request, reply) => {
        reply.send(await getUserById(request.params.id));
    });
}
