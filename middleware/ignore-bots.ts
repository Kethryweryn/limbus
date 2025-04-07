export default defineEventHandler(async (event) => {
    const path = getRequestURL(event).pathname;

    // On ignore les requêtes connues de robots WordPress
    if (path === '/xmlrpc.php') {
        setResponseStatus(event, 404, 'Not found');
        return 'Not found';
    }
});
