const Joi = require('joi');

module.exports = {
    name: 'routes/account/invite',
    version: '1.0.0',
    async register(server) {
        const User = server.methods.getModel('user');

        server.route({
            method: 'GET',
            path: '/{token}',
            options: {
                auth: 'guest',
                validate: {
                    params: Joi.object({
                        token: Joi.string()
                            .alphanum()
                            .length(25)
                            .required()
                            .description('25 character long activation token.')
                    }),
                    query: Joi.object({
                        chart: Joi.string()
                            .alphanum()
                            .length(5)
                            .description('5 character long chart id.')
                    })
                },
                async handler(request, h) {
                    const activationToken = request.params.token;
                    const user = await User.findOne({
                        where: { activate_token: activationToken, deleted: false }
                    });
                    const __ = server.methods.getTranslate(request);

                    if (user) {
                        return h.view('account/Invite.svelte', {
                            props: {
                                token: activationToken,
                                email: user.dataValues.email,
                                chart: request.query.chart,
                                headlineText: __('invite / h1 / chart'),
                                headlineTextBold: true,
                                introText: __('invite / h1 / chart'),
                                buttonText: __('account / invite / set-password')
                            }
                        });
                    } else {
                        const url =
                            `/?t=e&m=` +
                            encodeURIComponent(
                                __(
                                    'This activation token is invalid. Your email address is probably already activated.'
                                )
                            );
                        return h.redirect(url);
                    }
                }
            }
        });
    }
};
