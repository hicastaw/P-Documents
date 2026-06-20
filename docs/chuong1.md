## CHƯƠNG 1

## XÂY DỰNG NỀN TẢNG QUẢN LÝ TÀI LIỆU VÀ HỌC TẬP TRỰC TUYẾN P-DOCUMENTS

Chương này sẽ tập trung vào việc xác định yêu cầu cho nền tảng quản lý tài liệu và học tập trực tuyến P-Documents. Chúng ta sẽ bắt đầu bằng việc nắm rõ mục đích của hệ thống trong bối cảnh chuyển đổi số giáo dục đại học, khảo sát các giải pháp quản lý tài liệu và học tập hiện có, và chi tiết hóa yêu cầu hoạt đ ộng của ứng dụng dành cho người dùng. Tiếp theo, sẽ là phần tạo hình sản phẩm thông qua mô hình nghiệp vụ và thiết kế sơ đồ Use Case, tập trung vào trải nghiệm người dùng. Mục tiêu là xây dựng nền móng vững chắc cho quá trình phát triển, làm cơ sở cho các chương sau.

## 1. Bảng thuật ngữ

Trước khi đi vào mô tả chi tiết, phần này thống nhất các thuật ngữ chuyên ngành được sử dụng xuyên suốt chương, giúp người đọc tránh nhầm lẫn giữa thuật ngữ tiếng Việt và tên gọi kỹ thuật (tiếng Anh) tương ứng trong các sơ đồ UML.



| TT | Tên Tiếng Việt | Tên Tiếng Anh | Ngữ nghĩa |

| --- | --- | --- | --- |

| Nhóm thuật ngữ liên quan đến nội dung học tập | Nhóm thuật ngữ liên quan đến nội dung học tập | Nhóm thuật ngữ liên quan đến nội dung học tập | Nhóm thuật ngữ liên quan đến nội dung học tập |

| 1 | Tài liệu | Document | File định dạng PDF chứa nội dung học thuật, giáo trình. |

| 2 | Danh mục | Category | Phân loại tài liệu theo môn học hoặc chủ đề. |

| 3 | Bài thi trắc nghiệm | Quiz | Tập hợp các câu hỏi trắc nghiệm để kiểm tra kiến thức. |

| 4 | Câu hỏi | Question | Một thành phần của bài thi, kèm theo các đáp án lựa chọn. |

| 5 | Chủ đề diễn đàn | Thread | Một bài đăng khởi tạo cuộc thảo luận trên diễn đàn. |

| 6 | Bình luận | Comment | Lời nhắn phản hồi lại chủ đề hoặc bình luận khác. |

| 7 | Báo cáo vi phạm | Report | Lời tố cáo một tài liệu hoặc nội dung không hợp lệ. |

| Nhóm thuật ngữ liên quan hoạt động của người dùng | Nhóm thuật ngữ liên quan hoạt động của người dùng | Nhóm thuật ngữ liên quan hoạt động của người dùng | Nhóm thuật ngữ liên quan hoạt động của người dùng |

| 8 | Tải lên | Upload | Hành động đưa file tài liệu từ máy tính lên hệ thống. |

| 9 | Tải xuống | Download | Hành động lưu file tài liệu từ hệ thống về máy cá nhân. |

| 10 | Hỏi đáp AI | Chat with AI | Giao tiếp với trí tuệ nhân tạo để trích xuất thông tin từ tài liệu, có trích dẫn nguồn. |

| 11 | Làm bài thi | Take Quiz | Quá trình trả lời các câu hỏi trong một bài thi. |

| 12 | Đánh giá | Rate / Review | Chấm điểm chất lượng tài liệu (bằng số sao). |

| 13 | Quản trị | Manage | Hoạt động kiểm duyệt, thay đổi hoặc xóa bỏ dữ liệu của hệ thống. |



Bảng 1.0: Bảng thuật ngữ sử dụng trong hệ thống P-Documents

### 1.1. Xác định yêu cầu cho nền tảng quản lý tài liệu và học tập trực tuyến P-Documents

Đây là một nền tảng học tập và quản lý tài liệu học thuật tập trung, cho phép sinh viên và giảng viên chia sẻ, tìm kiếm và khai thác tài liệu PDF kết hợp với trợ lý hỏi đáp AI thông minh, hệ thống thi trắc nghiệm thời gian thực và diễn đàn thảo luận học thuật, thông qua giao diện trình duyệt web hiện đại.

Tạo ra một trải nghiệm học tập toàn diện cho người dùng, bao gồm khả năng tự động phát hiện và ngăn chặn tài liệu trùng lặp thông qua thuật toán băm SHA-256, hỗ trợ hỏi đáp AI với trích dẫn nguồn chính xác dựa trên kỹ thuật RAG, và cập nhật bảng xếp hạng thi trắc nghiệm theo thời gian thực để tăng tính cạnh tranh và học tập tích cực. Bên cạnh đó, tạo ra một môi trường diễn đàn học thuật có cấu trúc nơi người dùng có thể đặt câu hỏi, thảo luận và nhận thông báo tức thời, đảm bảo bảo mật thông tin tài khoản và tối ưu hóa hiệu suất lưu trữ tài liệu, nâng cao hiệu quả học tập tập thể.

### 1.2. Khảo sát những nghiên cứu liên quan

Sau khi tìm hiểu và trải nghiệm các nền tảng quản lý tài liệu và học tập phổ biến: Google Drive, Moodle, Notion, Xemtailieu và ChatPDF, có những ưu, nhược điểm như sau:



| Nền tảng | Ưu điểm | Nhược điểm |

| --- | --- | --- |

| Google Drive / OneDrive | - Hạ tầng ổn định, dung lượng lớn. - Đồng bộ đa thiết bị, giao diện quen thuộc. - Hỗ trợ làm việc nhóm trực tiếp tốt. | - Thiếu cơ chế phân loại học thuật chuyên sâu. - Không có cơ chế chống trùng lặp file. - Thiếu các công cụ học tập tương tác (AI, Quiz). |

| Moodle | - Cung cấp đầy đủ tính năng quản lý (LMS). - Phân quyền chi tiết theo vai trò. - Mã nguồn mở, tùy biến cao. | - Giao diện cũ, trải nghiệm người dùng (UX) kém. - Triển khai hạ tầng và bảo trì phức tạp. - Chưa tích hợp AI hỏi đáp thông minh. |

| Notion / Confluence | - Giao diện hiện đại, UX tuyệt vời. - Linh hoạt với đa dạng loại nội dung. - Tích hợp AI cơ bản trên workspace. | - Không có hệ thống thi trắc nghiệm (Quiz). - Không chuyên biệt cho quản lý kho file PDF. - Không tự động ngăn chặn trùng lặp dữ liệu. |

| Thư viện số (Xemtailieu, VNU) | - Kho tài liệu chuyên ngành phong phú. - Phân loại chi tiết theo trường, khoa, môn học. | - Trải nghiệm tìm kiếm và tải xuống còn hạn chế. - Không tích hợp AI hay diễn đàn tương tác. - Nội dung đôi khi bị rác, trùng lặp nhiều. |

| ChatPDF / AskYourPDF | - Trải nghiệm Chat AI với PDF đột phá. - Giao diện đơn giản, trích dẫn nguồn rõ ràng. | - Chỉ là công cụ AI đơn lẻ, thiếu tính cộng đồng. - Không lưu trữ tài liệu theo cấu trúc môn học. - Bản miễn phí giới hạn dung lượng và số câu hỏi. |



Bảng 1.1: Khảo sát ưu, nhược điểm các nền tảng học tập và quản lý tài liệu hiện có

=> Dựa vào các ưu, nhược điểm của các nền tảng trên, P-Documents cần đáp ứng được các yêu cầu:

Tích hợp toàn diện trong một hệ sinh thái: Kết hợp đồng thời kho tài liệu, AI hỏi đáp, thi trắc nghiệm và diễn đàn học thuật trong một nền tảng duy nhất, chia sẻ cùng một tài khoản người dùng và cơ sở dữ liệu.

Tự động chống trùng lặp tài liệu: Áp dụng thuật toán băm SHA-256 để phát hiện và ngăn chặn các tài liệu trùng lặp ngay tại thời điểm tải lên, xóa bỏ rác thải dữ liệu trên hệ thống.

Hỏi đáp AI có trích dẫn nguồn: Áp dụng kỹ thuật RAG kết hợp tìm kiếm từ khóa để trả lời câu hỏi người dùng dựa trên nội dung tài liệu thực, kèm trích dẫn nguồn chính xác.

Diễn đàn học thuật với thông báo tức thì: Xây dựng cơ chế bình luận đa cấp và thông báo push real-time đến chủ thread khi có người phản hồi.

Triển khai đơn giản, một lệnh: Đóng gói toàn bộ hệ thống bằng Docker Compose, phù hợp với môi trường học thuật không có hạ tầng phức tạp.

### 1.3. Mô hình nghiệp vụ bằng ngôn ngữ tự nhiên

Đây là bản mô tả yêu cầu của hệ thống P-Documents bằng ngôn ngữ tự nhiên. Phần mô tả chung như sau:

Phạm vi phần mềm

Phần mềm dạng ứng dụng web chạy trên trình duyệt, phục vụ sinh viên và giảng viên trong môi trường học tập. Phần mềm có thể truy cập được từ nhiều thiết bị cá nhân khác nhau có kết nối internet. Toàn bộ dữ liệu tài liệu, bài thi và thông tin người dùng được lưu trữ tập trung tại một máy chủ duy nhất.

Người dùng và chức năng của người dùng

Chỉ có hai nhóm đối tượng sau được phép sử dụng phần mềm: người dùng thông thường (sinh viên, giảng viên) và quản trị viên hệ thống (Admin).

Người dùng thông thường có thể thực hiện các chức năng:

Đăng ký và đăng nhập tài khoản.

Tải lên tài liệu PDF (kèm thông tin tiêu đề, mô tả, danh mục).

Tải xuống hoặc xem tài liệu trực tiếp.

Tìm kiếm tài liệu và lọc theo danh mục.

Hỏi đáp kiến thức với AI dựa trên nội dung tài liệu.

Tham gia các bài thi trắc nghiệm và xem bảng xếp hạng.

Tham gia diễn đàn: tạo chủ đề mới, bình luận, phản hồi bình luận.

Báo cáo các tài liệu vi phạm nội quy.

Quản trị viên có thể thực hiện các chức năng:

Đăng nhập tài khoản quản trị.

Xem báo cáo thống kê: tổng số tài khoản, tổng số tài liệu, tổng số báo cáo vi phạm.

Quản lý thông tin người dùng: xem danh sách, thay đổi quyền hạn (nâng/hạ quyền), xóa tài khoản.

Kiểm duyệt nội dung: xem danh sách các báo cáo vi phạm, quyết định bỏ qua báo cáo hoặc xóa tài liệu vi phạm.

Thông tin các đối tượng cần xử lý

Thông tin về tài khoản người dùng: họ tên, địa chỉ email, mật khẩu đăng nhập, vai trò (người dùng/quản trị viên), thời điểm tạo.

Thông tin về tài liệu: tiêu đề, mô tả ngắn, danh mục môn học, tên file, định dạng, dung lượng, mã băm nội dung, trạng thái xử lý, người đăng tải, thời điểm đăng tải, tổng lượt tải xuống, tổng lượt đánh giá (star).

Thông tin về bộ đề thi trắc nghiệm: tiêu đề bài thi, môn học, danh sách các câu hỏi (mỗi câu hỏi gồm nội dung, các đáp án lựa chọn, đáp án đúng), người tạo, thời điểm tạo.

Thông tin về kết quả thi: người dùng tham gia, bài thi tương ứng, danh sách câu trả lời đã chọn, điểm số đạt được, thời gian làm bài, thời điểm nộp bài.

Thông tin về chủ đề diễn đàn (thread): tiêu đề, nội dung bài viết gốc, người tạo, thời điểm tạo, thời điểm có cập nhật mới nhất.

Thông tin về bình luận diễn đàn: nội dung bình luận, người bình luận, chủ đề tương ứng, bình luận cha (nếu là phản hồi cho bình luận khác), thời điểm tạo.

Thông tin về báo cáo vi phạm: người báo cáo, tài liệu bị báo cáo, lý do báo cáo, trạng thái xử lý (đang chờ, đã giải quyết), thời điểm báo cáo.

Quan hệ giữa các đối tượng

Một hệ thống lưu trữ nhiều danh mục môn học, mỗi danh mục có thể chứa nhiều tài liệu khác nhau.

Một người dùng có thể tải lên nhiều tài liệu khác nhau tại các thời điểm khác nhau. Mỗi tài liệu chỉ thuộc về một người dùng duy nhất.

Một người dùng có thể tham gia làm bài thi nhiều lần đối với nhiều bộ đề khác nhau. Mỗi lần làm bài tạo ra một kết quả thi độc lập.

Một bộ đề thi có thể có nhiều người dùng khác nhau tham gia.

Một người dùng có thể tạo nhiều chủ đề thảo luận trên diễn đàn. Mỗi chủ đề thảo luận có thể nhận được nhiều bình luận từ nhiều người dùng khác nhau.

Một bình luận có thể có nhiều bình luận phản hồi (phản hồi đa cấp).

Một người dùng có thể báo cáo vi phạm nhiều tài liệu khác nhau. Một tài liệu có thể bị nhiều người dùng khác nhau báo cáo.

Mô tả nghiệp vụ chi tiết các chức năng

Nội dung phần này mô tả luồng thực hiện của từng chức năng trong hệ thống P-Documents:

Chức năng tải lên tài liệu: Người dùng muốn chia sẻ tài liệu lên nền tảng -> chọn chức năng tải lên tài liệu sau khi đã đăng nhập -> giao diện thêm tài liệu hiện ra, có các ô để nhập tiêu đề, chọn danh mục, ghi chú mô tả và khu vực để chọn file -> người dùng chọn 1 file PDF từ máy tính cá nhân, điền đầy đủ các thông tin và click tải lên -> hệ thống kiểm tra file và đối chiếu nội dung để đảm bảo tài liệu không bị trùng lặp -> hệ thống lưu tài liệu, cập nhật danh sách tài liệu và quay về trang danh sách tài liệu -> người dùng có thể thấy tài liệu mình vừa tải lên trong danh sách chung.

Chức năng tìm kiếm tài liệu: Người dùng có nhu cầu tìm tài liệu -> mở giao diện tìm kiếm của hệ thống, có ô nhập từ khóa và danh sách thả xuống để chọn danh mục -> người dùng nhập từ khóa tìm kiếm (tên tài liệu, môn học) và chọn một danh mục cụ thể, sau đó click tìm kiếm -> hệ thống tìm các tài liệu phù hợp với thông tin người dùng cung cấp -> giao diện danh sách kết quả hiện lên dưới dạng bảng, mỗi dòng có đầy đủ thông tin: tiêu đề tài liệu, danh mục, dung lượng, người tải lên, ngày tải lên, số lượt tải, số lượt đánh giá -> người dùng xem kết quả và click chọn tài liệu đúng với nhu cầu của mình.

Chức năng tải xuống (hoặc xem) tài liệu: Người dùng tìm thấy tài liệu ưng ý trong danh sách kết quả -> click chọn tài liệu đó -> giao diện thông tin chi tiết tài liệu hiện lên, bao gồm toàn bộ thông tin của tài liệu và các chức năng: xem trực tuyến, tải xuống, đánh giá, báo cáo -> nếu người dùng click xem trực tuyến, hệ thống mở giao diện đọc PDF ngay trên trình duyệt -> nếu người dùng click tải xuống, hệ thống ghi nhận tăng lượt tải cho tài liệu và trả về file PDF để lưu về máy tính.

Chức năng hỏi đáp AI với tài liệu: Người dùng muốn tìm hiểu nhanh thông tin trong một tài liệu -> trong giao diện chi tiết tài liệu, click chọn chức năng hỏi đáp AI -> giao diện hỏi đáp hiện lên, có khu vực hiển thị lịch sử trao đổi và ô nhập câu hỏi -> người dùng gõ câu hỏi bằng tiếng Việt và click gửi -> hệ thống tiếp nhận câu hỏi, phân tích nội dung bên trong tài liệu để tìm ra thông tin tương ứng -> hệ thống trả về câu trả lời và hiển thị lên màn hình, kèm theo thông tin trích dẫn chỉ rõ câu trả lời được lấy từ trang nào, đoạn nào trong tài liệu gốc -> người dùng đọc thông tin và có thể tiếp tục đặt câu hỏi mới.

Chức năng thi trắc nghiệm: Người dùng muốn làm bài kiểm tra kiến thức -> chọn chức năng danh sách bài thi sau khi đăng nhập -> giao diện hiện ra danh sách các bài thi đang mở, mỗi dòng có thông tin: tên bài thi, môn học, người tạo, số lượng câu hỏi -> người dùng click chọn 1 bài thi và click bắt đầu làm bài -> giao diện làm bài thi hiện lên hiển thị lần lượt các câu hỏi và các đáp án lựa chọn -> người dùng đọc câu hỏi, click chọn đáp án cho đến khi hết câu hỏi và click nộp bài -> hệ thống ghi nhận câu trả lời, đối chiếu đáp án, chấm điểm và lưu kết quả -> giao diện hiện lên thông báo điểm số đạt được, đồng thời cập nhật và hiển thị bảng xếp hạng chung của bài thi đó với thông tin vị trí của người dùng.

Chức năng thảo luận diễn đàn: Người dùng muốn trao đổi kiến thức -> chọn chức năng diễn đàn sau khi đăng nhập -> giao diện danh sách các chủ đề thảo luận hiện lên, mỗi dòng có thông tin: tiêu đề chủ đề, người tạo, ngày tạo, số lượng bình luận -> người dùng có thể click tạo chủ đề mới, giao diện hiện ra ô nhập tiêu đề và nội dung -> người dùng nhập thông tin và click đăng bài -> hệ thống lưu chủ đề và hiển thị lên đầu danh sách -> nếu người dùng click vào một chủ đề có sẵn, giao diện chi tiết chủ đề hiện lên cùng danh sách các bình luận bên dưới -> người dùng có thể nhập nội dung vào ô bình luận và click gửi -> hệ thống lưu bình luận và hiển thị bổ sung vào danh sách bình luận của chủ đề đó.

Chức năng báo cáo tài liệu vi phạm: Người dùng phát hiện tài liệu có nội dung không phù hợp -> trong giao diện chi tiết của tài liệu đó, click chọn chức năng báo cáo -> giao diện báo cáo hiện ra yêu cầu nhập lý do -> người dùng gõ lý do báo cáo và click gửi -> hệ thống lưu lại thông tin báo cáo và thông báo gửi thành công cho người dùng.

Chức năng xem thống kê (Quản trị viên): Quản trị viên muốn nắm bắt tình hình hệ thống -> đăng nhập vào tài khoản quản trị và chọn chức năng trang chủ quản trị -> hệ thống tổng hợp dữ liệu và giao diện hiện lên các thông tin thống kê tổng quan: tổng số tài khoản đang hoạt động, tổng số lượng tài liệu đã được tải lên, tổng số lượng báo cáo vi phạm đang chờ xử lý.

Chức năng quản lý người dùng (Quản trị viên): Quản trị viên muốn kiểm soát tài khoản -> chọn chức năng quản lý người dùng -> giao diện danh sách toàn bộ người dùng hiện lên, mỗi dòng có: tên, email, vai trò, ngày tham gia -> quản trị viên có thể click vào chức năng phân quyền để thay đổi vai trò của một người dùng, hoặc click chức năng xóa để gỡ bỏ hoàn toàn một tài khoản vi phạm -> hệ thống cập nhật thông tin và tải lại danh sách mới nhất.

Chức năng kiểm duyệt nội dung (Quản trị viên): Quản trị viên cần xử lý các báo cáo vi phạm -> chọn chức năng kiểm duyệt nội dung -> giao diện danh sách các báo cáo hiện lên, mỗi dòng có: tên người báo cáo, tên tài liệu bị báo cáo, lý do báo cáo, ngày báo cáo -> quản trị viên xem xét lý do, có thể mở tài liệu để kiểm tra, sau đó click chọn chức năng bỏ qua nếu báo cáo sai, hoặc click chọn chức năng xóa tài liệu nếu thực sự có vi phạm -> hệ thống thực thi lệnh, xóa báo cáo (và xóa tài liệu nếu được yêu cầu), sau đó cập nhật lại danh sách báo cáo.

Yêu cầu chức năng



| Nhóm | Mô tả yêu cầu |

| --- | --- |

| Quản lý tài khoản | - Người dùng có thể tạo tài khoản mới bằng email, mật khẩu và họ tên. Người dùng có thể đăng nhập và hệ thống ghi nhớ phiên làm việc. - Người dùng có thể xem và cập nhật thông tin cá nhân. |

| Quản lý tài liệu | - Người dùng có thể tải lên file PDF kèm tiêu đề, mô tả và danh mục. - Hệ thống tự động phát hiện tài liệu trùng lặp và thông báo cho người dùng. - Người dùng có thể tìm kiếm tài liệu theo từ khóa và lọc theo danh mục. - Người dùng có thể xem hoặc tải tài liệu về máy. |

| Hỏi đáp AI | - Người dùng có thể đặt câu hỏi bằng tiếng Việt về nội dung tài liệu. - Hệ thống trả lời dựa trên nội dung tài liệu thực tế và chỉ rõ nguồn trích dẫn. |

| Thi trắc nghiệm | - Người dùng có thể xem danh sách bài thi và tham gia làm bài. - Hệ thống chấm điểm tự động và bảng xếp hạng cập nhật ngay sau khi nộp bài. |

| Diễn đàn | - Người dùng có thể tạo chủ đề thảo luận mới. - Người dùng có thể bình luận và phản hồi bình luận của người khác. |

| Thông báo | - Người dùng nhận thông báo ngay lập tức khi có người bình luận vào bài của mình. - Số thông báo chưa đọc hiển thị trực tiếp trên giao diện. |



Bảng 1.2: Yêu cầu chức năng của hệ thống P-Documents

Yêu cầu phi chức năng



| Loại | Mô tả yêu cầu |

| --- | --- |

| Tốc độ phản hồi | Bảng xếp hạng bài thi cập nhật đến tất cả người dùng trong vòng dưới 1 giây sau khi nộp bài. |

| Bảo mật | Mật khẩu người dùng được mã hóa, không lưu dưới dạng văn bản thường; phiên đăng nhập có thời hạn rõ ràng. |

| Tương thích | Hệ thống hoạt động ổn định trên các trình duyệt phổ biến (Chrome, Firefox, Edge). |

| Chống trùng lặp | Hệ thống tự động từ chối tài liệu có nội dung giống với tài liệu đã tồn tại. |

| Dễ triển khai | Toàn bộ hệ thống khởi động bằng một lệnh duy nhất, không yêu cầu cài đặt phức tạp. |

| Nhất quán dữ liệu | Trạng thái tài liệu (đang xử lý / đã duyệt / bị từ chối) được đồng bộ chính xác giữa các thành phần hệ thống. |



Bảng 1.3: Yêu cầu phi chức năng của hệ thống P-Documents

### 1.4. Xây dựng sơ đồ Use Case

### a) Sơ đồ Use Case tổng quan

Mục đích của bước này là xây dựng một bản mô tả yêu cầu của người dùng bằng ngôn ngữ kỹ thuật (UML).

### Xác định các actor của hệ thống

Actor Người dùng (User): là người dùng trực tiếp của hệ thống. Trong thực tế có hai vai trò là Sinh viên và Giảng viên, nhưng cả hai đều cùng thực hiện một nhóm hành vi giống nhau trên hệ thống - khai thác và đóng góp nội dung học tập (tải lên/tìm tài liệu, hỏi đáp AI, làm bài thi, tham gia diễn đàn) - nên được gộp chung thành một actor duy nhất là User để đơn giản hóa mô hình, tránh trùng lặp use case không cần thiết. Người dùng cần đăng nhập trước khi thực hiện bất kỳ chức năng nào.

Actor Quản trị viên (Admin): là người quản lý hệ thống, không trực tiếp sử dụng các tính năng học tập, nhưng có quyền truy cập trang quản trị để kiểm soát tài khoản và nội dung.

### Các chức năng liên quan đến các actor

Người dùng (User): có thể thực hiện các chức năng đăng ký tài khoản, đăng nhập hệ thống, xem và cập nhật thông tin cá nhân. Bên cạnh đó, người dùng có thể tải lên tài liệu PDF, và thực hiện một nhóm hành vi khai thác tài liệu liên quan chặt chẽ với nhau: tìm kiếm tài liệu, xem hoặc tải xuống tài liệu, hỏi đáp AI với tài liệu, và báo cáo tài liệu vi phạm. Ngoài ra, người dùng có thể tham gia làm bài thi trắc nghiệm, xem bảng xếp hạng thời gian thực, tạo chủ đề thảo luận trên diễn đàn, bình luận và phản hồi bình luận, và nhận thông báo khi có tương tác mới.

Quản trị viên (Admin): có thể thực hiện chức năng đăng nhập hệ thống, xem thống kê tổng quan hệ thống, quản lý tài khoản người dùng và kiểm duyệt nội dung vi phạm.


![image](docx_export/chuong1_images/img_1.png)

Hình 1.1: Sơ đồ Use Case tổng quan của hệ thống P-Documents

Các use case được mô tả như sau:

Tải lên tài liệu PDF: UC này cho phép người dùng tải lên các tài liệu PDF vào hệ thống.

Tìm kiếm & khai thác tài liệu: UC chính cho phép người dùng tìm kiếm tài liệu có trong hệ thống; mở rộng (extend) gồm: xem trực tuyến/tải xuống tài liệu, hỏi đáp AI với tài liệu, và báo cáo tài liệu vi phạm.

Thi trắc nghiệm: UC này cho phép người dùng tham gia làm bài thi trắc nghiệm và xem bảng xếp hạng.

Diễn đàn: UC này cho phép người dùng tạo chủ đề thảo luận, bình luận và tương tác trên diễn đàn.

Thống kê hệ thống: UC này cho phép quản trị viên vào xem các báo cáo thống kê về tình hình hoạt động của hệ thống.

Quản lý người dùng: UC này cho phép quản trị viên có thể xem, thay đổi quyền hạn hoặc xóa người dùng.

Kiểm duyệt nội dung: UC này cho phép quản trị viên quản lý và kiểm soát các báo cáo vi phạm trên hệ thống.

b) Phân rã chi tiết các Use Case

Mục đích của bước này là mô tả chi tiết các use case đã xác định được trong sơ đồ tổng quan. Các sơ đồ chi tiết dưới đây được giữ nguyên theo bản thiết kế gốc — chúng vẫn đúng và không xung đột với việc nhóm lại sơ đồ tổng quan ở trên, vì sơ đồ tổng quan chỉ thay đổi quan hệ ở mức cao, không thay đổi luồng nghiệp vụ chi tiết của từng use case.

### Use case tải lên tài liệu PDF

Người dùng có thể chia sẻ tài liệu lên hệ thống thông qua chức năng tải lên tài liệu PDF. Để tải lên, người dùng cần có file PDF cần chia sẻ. Hệ thống sẽ tự động thực hiện các bước kiểm tra trùng lặp và trích xuất nội dung cho tính năng AI.

Tải lên tài liệu PDF: UC chính cho phép người dùng thực hiện toàn bộ quá trình chia sẻ tài liệu lên hệ thống.

Nhập thông tin tài liệu: UC này bao gồm các thao tác điền tiêu đề, mô tả và chọn danh mục cho tài liệu.

Chọn file đính kèm: UC này cho phép người dùng tải lên file PDF từ thiết bị cá nhân.

Đăng nhập: UC này cho phép hệ thống xác thực người dùng, là điều kiện bắt buộc trước khi thực hiện tải lên tài liệu.


![image](docx_export/chuong1_images/img_2.gif)

Hình 1.2: Sơ đồ chi tiết use case Tải lên tài liệu PDF

### Use case tải xuống hoặc xem trực tuyến

Người dùng có thể đọc tài liệu ngay trên trình duyệt hoặc lưu file về máy tính cá nhân. Quá trình bắt đầu khi người dùng duyệt danh sách hoặc kết quả tìm kiếm, nhấn vào tài liệu mong muốn và lựa chọn thao tác “Xem trực tuyến” hoặc “Tải xuống” tùy theo nhu cầu.

Tải xuống hoặc xem trực tuyến: UC chính cho phép người dùng thao tác với tài liệu đã chọn.

Duyệt/Tìm kiếm tài liệu: UC này giúp người dùng tìm thấy và chọn đúng tài liệu cần thiết trước khi thao tác.

Xem trực tuyến: UC này là một tùy chọn cho phép hiển thị nội dung tài liệu PDF trực tiếp trên giao diện trình duyệt web.

Tải xuống tài liệu: UC này là một tùy chọn cho phép người dùng lưu trữ file PDF của tài liệu về thiết bị cá nhân.


![image](docx_export/chuong1_images/img_3.gif)

Hình 1.3: Sơ đồ chi tiết use case Tải xuống hoặc xem trực tuyến

### Use case tìm kiếm tài liệu

Người dùng có thể tìm kiếm tài liệu trên hệ thống bằng cách nhập từ khóa. Nhờ thuật toán thông minh, hệ thống sẽ phân tích ý nghĩa của từ khóa để tìm ra các tài liệu có nội dung liên quan nhất (kể cả khi tiêu đề không chứa chính xác từ đó) và trả về kết quả dưới dạng danh sách.

Tìm kiếm tài liệu: UC chính cho phép người dùng nhập từ khóa để tra cứu tài liệu trên hệ thống.

Nhập từ khóa tìm kiếm: UC này là thao tác người dùng gõ từ khóa cần tìm vào ô tìm kiếm.


![image](docx_export/chuong1_images/img_4.gif)

Hình 1.4: Sơ đồ chi tiết use case Tìm kiếm tài liệu

### Use case hỏi đáp AI với tài liệu

Người dùng có thể tương tác với trợ lý AI bằng cách gõ câu hỏi thông thường. Quá trình bắt đầu khi người dùng chọn phạm vi hỏi (một tài liệu cụ thể hoặc toàn bộ kho tài liệu) và đặt câu hỏi. Hệ thống sẽ tự động truy xuất nội dung tài liệu, tổng hợp câu trả lời và hiển thị kết quả kèm theo thông tin trích dẫn nguồn rõ ràng.

Hỏi đáp AI: UC chính cho phép người dùng đặt câu hỏi và nhận tư vấn từ trợ lý AI.

Chọn phạm vi hỏi đáp: UC này cho phép người dùng thiết lập vùng dữ liệu (một tài liệu cụ thể hoặc toàn bộ kho) để AI tập trung tìm kiếm.

Nhập câu hỏi: UC này là thao tác người dùng trực tiếp gõ câu hỏi bằng ngôn ngữ tự nhiên để tương tác với AI.


![image](docx_export/chuong1_images/img_5.gif)

Hình 1.5: Sơ đồ chi tiết use case Hỏi đáp AI

### Use case thi trắc nghiệm

Người dùng có thể tham gia các bài thi trắc nghiệm đang mở trên hệ thống. Quá trình bắt đầu khi người dùng chọn bài thi, thực hiện trả lời các câu hỏi và nộp bài. Hệ thống sẽ tự động chấm điểm, trả về kết quả ngay lập tức, đồng thời cập nhật bảng xếp hạng thời gian thực (real-time) cho tất cả mọi người cùng xem mà không cần tải lại trang.

Thi trắc nghiệm: UC chính cho phép người dùng tham gia làm bài thi trên hệ thống.

Xem danh sách bài thi: UC này cho phép người dùng duyệt qua các bài thi đang mở để lựa chọn tham gia.

Tham gia làm bài: UC này bao gồm các thao tác người dùng đọc câu hỏi và chọn đáp án tương ứng.

Nộp bài thi: UC này ghi nhận hành động hoàn thành và nộp bài của người dùng để xem điểm số.

Xem bảng xếp hạng: UC này là một tùy chọn mở rộng cho phép người dùng theo dõi điểm số và thứ hạng của mình so với các người dùng khác.


![image](docx_export/chuong1_images/img_6.gif)

Hình 1.6: Sơ đồ chi tiết use case Thi trắc nghiệm

### Use case diễn đàn

Người dùng có thể tham gia tương tác trên diễn đàn bằng cách tạo chủ đề (thread) mới hoặc thảo luận trong các chủ đề đã có. Khi tạo mới, người dùng nhập tiêu đề và nội dung rồi đăng bài. Các người dùng khác có thể vào xem, để lại bình luận hoặc phản hồi trực tiếp vào một bình luận cụ thể (hỗ trợ bình luận đa cấp). Hệ thống sẽ tự động sắp xếp danh sách để luôn đưa các chủ đề có hoạt động mới nhất lên đầu tiên.

Tham gia diễn đàn: UC chính cho phép người dùng tương tác, chia sẻ và thảo luận học thuật trong cộng đồng.

Xem danh sách chủ đề: UC này cho phép người dùng xem các bài đăng, hệ thống đảm bảo sắp xếp các chủ đề có hoạt động mới nhất lên đầu.

Tạo chủ đề mới: UC này là một tùy chọn mở rộng cho phép người dùng mở ra một cuộc thảo luận mới bằng cách đăng bài viết.

Bình luận và phản hồi: UC này là một tùy chọn mở rộng cho phép người dùng tham gia thảo luận, trả lời bài viết hoặc phản hồi cụ thể vào bình luận của người khác.


![image](docx_export/chuong1_images/img_7.gif)

Hình 1.7: Sơ đồ chi tiết use case Diễn đàn

### Use case thống kê hệ thống

Quản trị viên có thể theo dõi tình hình hoạt động của hệ thống thông qua chức năng thống kê. Sau khi đăng nhập và truy cập trang quản trị, giao diện sẽ tự động tổng hợp và hiển thị bức tranh tổng quan bao gồm: tổng số tài khoản người dùng, tổng số tài liệu đã tải lên, và số lượng báo cáo vi phạm đang chờ xử lý.

Thống kê hệ thống: UC chính cho phép quản trị viên xem các báo cáo tổng quan về tình hình hoạt động của hệ thống.

Đăng nhập quản trị: UC này bắt buộc quản trị viên phải xác thực tài khoản trước khi truy cập trang thống kê.

Xem thống kê tài khoản: UC này cho phép quản trị viên xem tổng số lượng tài khoản trên hệ thống.

Xem thống kê tài liệu: UC này cho phép quản trị viên theo dõi tổng số tài liệu đang lưu trữ.

Xem thống kê báo cáo vi phạm: UC này cho phép quản trị viên biết được số lượng các báo cáo vi phạm đang chờ được kiểm duyệt và xử lý.


![image](docx_export/chuong1_images/img_8.gif)

Hình 1.8: Sơ đồ chi tiết use case Thống kê hệ thống

### Use case quản lý người dùng

Quản trị viên có toàn quyền kiểm soát các tài khoản trên hệ thống thông qua chức năng quản lý người dùng. Sau khi đăng nhập, quản trị viên có thể xem danh sách toàn bộ người dùng. Từ danh sách này, quản trị viên có thể chọn một tài khoản cụ thể để thực hiện các hành động nâng cao như thay đổi quyền hạn (cấp quyền quản trị hoặc hạ quyền xuống người dùng thường) hoặc xóa các tài khoản vi phạm quy định. Hệ thống sẽ ngay lập tức cập nhật và hiển thị lại danh sách mới nhất.

Quản lý người dùng: UC chính cho phép quản trị viên xem, thiết lập quyền và xử lý các tài khoản trên hệ thống.

Đăng nhập quản trị: UC này bắt buộc quản trị viên phải xác thực trước khi thực hiện các tác vụ quản lý.

Xem danh sách người dùng: UC này hiển thị cho quản trị viên toàn bộ thông tin tài khoản đang tồn tại trên hệ thống.

Thay đổi quyền hạn: UC này là một tùy chọn mở rộng cho phép quản trị viên phân quyền lại cho một tài khoản cụ thể.

Xóa tài khoản: UC này là một tùy chọn mở rộng cho phép quản trị viên gỡ bỏ các tài khoản vi phạm khỏi hệ thống.


![image](docx_export/chuong1_images/img_9.gif)

Hình 1.9: Sơ đồ chi tiết use case Quản lý người dùng

### Use case kiểm duyệt nội dung vi phạm

Quản trị viên có nhiệm vụ duy trì môi trường học thuật trong sạch bằng cách kiểm duyệt các báo cáo vi phạm từ người dùng. Khi truy cập vào mục kiểm duyệt, quản trị viên có thể xem chi tiết danh sách các báo cáo (bao gồm người báo cáo, tài liệu bị báo cáo và lý do). Dựa trên thông tin này, quản trị viên sẽ đưa ra quyết định: “Bỏ qua” nếu báo cáo không có căn cứ (hệ thống sẽ xóa báo cáo và giữ nguyên tài liệu), hoặc “Xóa tài liệu” nếu thực sự có vi phạm (hệ thống sẽ gỡ bỏ tài liệu và tự động xóa các báo cáo liên quan). Hệ thống sau đó sẽ cập nhật và hiển thị lại danh sách mới nhất.

Kiểm duyệt nội dung: UC chính cho phép quản trị viên xem xét và xử lý các báo cáo vi phạm về tài liệu trên hệ thống.

Đăng nhập quản trị: UC này bắt buộc quản trị viên phải xác thực trước khi thực hiện chức năng kiểm duyệt.

Xem danh sách báo cáo vi phạm: UC này cho phép quản trị viên xem danh sách chi tiết các tài liệu đang bị người dùng khác báo cáo.

Bỏ qua báo cáo: UC này là tùy chọn mở rộng khi quản trị viên xác định báo cáo là sai sự thật, hệ thống sẽ xóa báo cáo đó đi.

Xóa tài liệu vi phạm: UC này là tùy chọn mở rộng khi báo cáo là chính xác, hệ thống sẽ gỡ bỏ tài liệu khỏi nền tảng và xóa các báo cáo liên quan.


![image](docx_export/chuong1_images/img_10.gif)

Hình 1.10: Sơ đồ chi tiết use case Kiểm duyệt nội dung vi phạm

### 1.5. Thiết kế tương tác cho sản phẩm

Phần này trình bày thiết kế giao diện trực quan của hệ thống P-Documents, phản ánh chính xác các luồng nghiệp vụ đã định nghĩa ở Mục 1.3 và các Use Case tại Mục 1.4.


![image](docx_export/chuong1_images/img_11.gif)

Hình 1.11: Thiết kế giao diện Trang Đăng nhập / Đăng ký


![image](docx_export/chuong1_images/img_12.gif)

Hình 1.12: Thiết kế giao diện Trang Tài liệu — Danh sách và Upload tài liệu


![image](docx_export/chuong1_images/img_13.gif)

Hình 1.13: Thiết kế giao diện Trang RAG Chat — Hỏi đáp AI với tài liệu


![image](docx_export/chuong1_images/img_14.gif)

Hình 1.14: Thiết kế giao diện Trang Quiz — Làm bài thi và Bảng xếp hạng


![image](docx_export/chuong1_images/img_15.gif)

Hình 1.15: Thiết kế giao diện Trang Diễn đàn — Danh sách thread và Chi tiết thread


![image](docx_export/chuong1_images/img_16.gif)

Hình 1.16: Thiết kế giao diện Trang Admin Dashboard — Thống kê và Kiểm duyệt nội dung