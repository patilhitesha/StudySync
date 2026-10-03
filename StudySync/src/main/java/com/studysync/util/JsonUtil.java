package com.studysync.util;

import java.io.IOException;
import javax.servlet.http.HttpServletResponse;

public class JsonUtil {
    public static void send(HttpServletResponse response, String json) throws IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(json);
    }
}
